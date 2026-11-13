import type { Location } from '../domain/types';
import { parseTargets } from '../domain/targets';
import type { LevelMap, PendingMap, TrackedVariant } from '../domain/tracking';
import { logError } from '../lib/logError';
import { chunk } from './batch';
import { friendlyMessage } from './errors';
import type { GraphqlClient } from './client';
import { listLocations } from './locations';

/** Product metafield: true marks the product for the Inventory report. Searchable, so it lives on the product. */
export const TRACKED_METAFIELD = { namespace: 'choco_track', key: 'tracked' } as const;
/** Variant metafield: JSON of per-location min/max targets. A variant with any target is tracked. */
export const TARGETS_METAFIELD = { namespace: 'choco_track', key: 'targets' } as const;
/** App-owned metadata on the app installation: ordered ids of the locations that supply transfers. */
export const SOURCES_METAFIELD = { namespace: '$app:inventory', key: 'sources' } as const;
/** Tag on every draft transfer the app creates, so its drafts can be found again. */
export const TRANSFER_TAG = 'choco-track';

const PRODUCT_PAGE = 250;
const MAX_PRODUCT_PAGES = 2;
const PRODUCT_BATCH = 10;
const VARIANTS_PER_PRODUCT = 30;
const LEVEL_BATCH = 25;

export interface ReportVariant extends TrackedVariant {
  readonly inventoryItemId: string;
  /** Shopify's version marker of the targets metafield, used to refuse overwriting someone else's edit. */
  readonly digest: string | null;
}

export interface ReportProduct {
  readonly id: string;
  readonly title: string;
  readonly imageUrl?: string;
  readonly variants: readonly ReportVariant[];
  /** The product has more variants than the report reads. */
  readonly truncated: boolean;
}

export interface InventoryReport {
  readonly locations: readonly Location[];
  readonly sourceIds: readonly string[];
  readonly products: readonly ReportProduct[];
  readonly levels: LevelMap;
  readonly pending: PendingMap;
  /** Set when draft transfers could not be read; suggestions must not be shown without them. */
  readonly draftsError?: string;
}

const FLAGGED_QUERY = `#graphql
  query FlaggedProducts($query: String!, $after: String) {
    products(first: ${PRODUCT_PAGE}, query: $query, after: $after) {
      nodes { id }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

interface FlaggedPage {
  products: { nodes: ReadonlyArray<{ id: string }>; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
}

/** Ids of the products flagged for the report (read from Shopify's search, so a new flag lags by a few seconds). */
export const findFlaggedProductIds = async (client: GraphqlClient): Promise<readonly string[]> => {
  const query = `metafields.${TRACKED_METAFIELD.namespace}.${TRACKED_METAFIELD.key}:true`;
  const readPage = async (after: string | null, page: number, found: readonly string[]): Promise<readonly string[]> => {
    const data = await client<FlaggedPage>(FLAGGED_QUERY, { query, after });
    const ids = [...found, ...data.products.nodes.map((n) => n.id)];
    const { hasNextPage, endCursor } = data.products.pageInfo;
    return hasNextPage && page < MAX_PRODUCT_PAGES ? readPage(endCursor, page + 1, ids) : ids;
  };
  return readPage(null, 1, []);
};

const PRODUCTS_QUERY = `#graphql
  query TrackedProducts($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        title
        featuredMedia { preview { image { url } } }
        variants(first: ${VARIANTS_PER_PRODUCT}) {
          nodes {
            id
            title
            sku
            image { url }
            inventoryItem { id }
            targets: metafield(namespace: "${TARGETS_METAFIELD.namespace}", key: "${TARGETS_METAFIELD.key}") { value compareDigest }
          }
          pageInfo { hasNextPage }
        }
      }
    }
  }
`;

interface ProductNode {
  readonly id?: string;
  readonly title: string;
  readonly featuredMedia: { readonly preview: { readonly image: { readonly url: string } | null } | null } | null;
  readonly variants: {
    readonly nodes: ReadonlyArray<{
      readonly id: string;
      readonly title: string;
      readonly sku: string | null;
      readonly image: { readonly url: string } | null;
      readonly inventoryItem: { readonly id: string };
      readonly targets: { readonly value: string; readonly compareDigest: string | null } | null;
    }>;
    readonly pageInfo: { readonly hasNextPage: boolean };
  };
}

const toProduct = (node: ProductNode & { id: string }): ReportProduct => {
  const productImage = node.featuredMedia?.preview?.image?.url;
  return {
    id: node.id,
    title: node.title,
    ...(productImage ? { imageUrl: productImage } : {}),
    truncated: node.variants.pageInfo.hasNextPage,
    variants: node.variants.nodes.map((v) => {
      const imageUrl = v.image?.url ?? productImage;
      return {
        id: v.id,
        productId: node.id,
        productTitle: node.title,
        title: v.title,
        sku: v.sku ?? '',
        ...(imageUrl ? { imageUrl } : {}),
        inventoryItemId: v.inventoryItem.id,
        targets: parseTargets(v.targets?.value),
        digest: v.targets?.compareDigest ?? null,
      };
    }),
  };
};

/** Products with their variants and targets, sorted by title. Ids that are missing or not products are skipped. */
export const loadProducts = async (client: GraphqlClient, ids: readonly string[]): Promise<readonly ReportProduct[]> => {
  const pages = await Promise.all(
    chunk(ids, PRODUCT_BATCH).map((batch) => client<{ nodes: ReadonlyArray<ProductNode | null> }>(PRODUCTS_QUERY, { ids: batch })),
  );
  return pages
    .flatMap((p) => p.nodes)
    .filter((n): n is ProductNode & { id: string } => n !== null && n.id !== undefined && n.variants !== undefined)
    .map(toProduct)
    .sort((a, b) => a.title.localeCompare(b.title));
};

const LEVELS_QUERY = `#graphql
  query TrackedLevels($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        inventoryItem {
          inventoryLevels(first: 20) {
            nodes { location { id } quantities(names: ["available", "incoming"]) { name quantity } }
          }
        }
      }
    }
  }
`;

interface LevelNode {
  readonly id?: string;
  readonly inventoryItem: {
    readonly inventoryLevels: {
      readonly nodes: ReadonlyArray<{
        readonly location: { readonly id: string };
        readonly quantities: ReadonlyArray<{ readonly name: string; readonly quantity: number }>;
      }>;
    };
  };
}

const quantityNamed = (quantities: ReadonlyArray<{ name: string; quantity: number }>, name: string): number =>
  quantities.find((q) => q.name === name)?.quantity ?? 0;

/** Available and incoming quantity per variant per location. A location with no level means "not stocked there". */
export const loadLevels = async (client: GraphqlClient, variantIds: readonly string[]): Promise<LevelMap> => {
  const pages = await Promise.all(
    chunk(variantIds, LEVEL_BATCH).map((ids) => client<{ nodes: ReadonlyArray<LevelNode | null> }>(LEVELS_QUERY, { ids })),
  );
  return Object.fromEntries(
    pages
      .flatMap((p) => p.nodes)
      .filter((n): n is LevelNode & { id: string } => n !== null && n.id !== undefined)
      .map((n) => [
        n.id,
        Object.fromEntries(
          n.inventoryItem.inventoryLevels.nodes.map((l) => [
            l.location.id,
            { available: quantityNamed(l.quantities, 'available'), incoming: quantityNamed(l.quantities, 'incoming') },
          ]),
        ),
      ]),
  );
};

const DRAFT_PAGE = 50;

export class TooManyDraftsError extends Error {
  constructor() {
    super(`There are more than ${DRAFT_PAGE} open draft transfers from this app. Mark or delete some in Shopify so none are missed.`);
    this.name = 'TooManyDraftsError';
  }
}

const DRAFTS_QUERY = `#graphql
  query DraftTransfers($query: String!) {
    inventoryTransfers(first: ${DRAFT_PAGE}, query: $query) {
      pageInfo { hasNextPage }
      nodes {
        destination { location { id } }
        lineItems(first: 100) { nodes { inventoryItem { id } totalQuantity } }
      }
    }
  }
`;

interface DraftsData {
  inventoryTransfers: {
    pageInfo?: { hasNextPage: boolean };
    nodes: ReadonlyArray<{
      destination: { location: { id: string } | null } | null;
      lineItems: { nodes: ReadonlyArray<{ inventoryItem: { id: string } | null; totalQuantity: number }> };
    }>;
  };
}

/** Quantities sitting in draft transfers this app created, by variant and destination. They count as "on the way". */
export const loadPendingDrafts = async (
  client: GraphqlClient,
  variants: ReadonlyArray<Pick<ReportVariant, 'id' | 'inventoryItemId'>>,
): Promise<PendingMap> => {
  if (variants.length === 0) return {};
  const variantByItem = new Map(variants.map((v) => [v.inventoryItemId, v.id]));
  const data = await client<DraftsData>(DRAFTS_QUERY, { query: `status:draft tag:${TRANSFER_TAG}` });
  if (data.inventoryTransfers.pageInfo?.hasNextPage) throw new TooManyDraftsError();
  const lines = data.inventoryTransfers.nodes.flatMap((t) => {
    const destinationId = t.destination?.location?.id;
    return destinationId
      ? t.lineItems.nodes.flatMap((l) => {
          const variantId = l.inventoryItem ? variantByItem.get(l.inventoryItem.id) : undefined;
          return variantId ? [{ variantId, destinationId, quantity: l.totalQuantity }] : [];
        })
      : [];
  });
  return lines.reduce<PendingMap>(
    (acc, { variantId, destinationId, quantity }) => ({
      ...acc,
      [variantId]: { ...acc[variantId], [destinationId]: (acc[variantId]?.[destinationId] ?? 0) + quantity },
    }),
    {},
  );
};

const SOURCES_QUERY = `#graphql
  query SourceLocations {
    currentAppInstallation {
      metafield(namespace: "${SOURCES_METAFIELD.namespace}", key: "${SOURCES_METAFIELD.key}") { value }
    }
  }
`;

/** Ordered ids of the locations that supply transfers (saved with the app, not in a database). */
export const loadSourceIds = async (client: GraphqlClient): Promise<readonly string[]> => {
  const data = await client<{ currentAppInstallation: { metafield: { value: string } | null } }>(SOURCES_QUERY);
  try {
    const parsed: unknown = JSON.parse(data.currentAppInstallation.metafield?.value ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

const draftsUnavailable = (err: unknown): string =>
  `Draft transfers couldn't be read, so transfer suggestions are hidden. ${err instanceof TooManyDraftsError ? err.message : friendlyMessage(err)}`;

/** Everything the Inventory screen needs, read with as much parallelism as the dependencies allow. */
export const loadInventoryReport = async (client: GraphqlClient): Promise<InventoryReport> => {
  const [locations, sourceIds, products] = await Promise.all([
    listLocations(client),
    loadSourceIds(client),
    findFlaggedProductIds(client).then((ids) => loadProducts(client, ids)),
  ]);
  const variants = products.flatMap((p) => p.variants);
  const [levels, drafts] = await Promise.all([
    loadLevels(client, variants.map((v) => v.id)),
    loadPendingDrafts(client, variants).then(
      (pending) => ({ pending, error: undefined as string | undefined }),
      (err: unknown) => {
        logError('draft transfers could not be read', err);
        return { pending: {} as PendingMap, error: draftsUnavailable(err) };
      },
    ),
  ]);
  return { locations, sourceIds, products, levels, pending: drafts.pending, ...(drafts.error ? { draftsError: drafts.error } : {}) };
};
