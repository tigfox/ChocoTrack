import { serializeTargets, type Targets } from '../domain/targets';
import { numericId, sanitize } from './catalog';
import type { GraphqlClient } from './client';
import { assertNoUserErrors, ShopifyApiError, type UserError } from './errors';
import { SOURCES_METAFIELD, TARGETS_METAFIELD, TRACKED_METAFIELD, TRANSFER_TAG } from './trackedCatalog';

const SET_METAFIELDS = `#graphql
  mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) { metafields { key compareDigest } userErrors { field message code } }
  }
`;

const DELETE_METAFIELDS = `#graphql
  mutation DeleteMetafields($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) { deletedMetafields { key } userErrors { field message } }
  }
`;

interface SetData {
  metafieldsSet: { metafields: ReadonlyArray<{ key: string; compareDigest: string | null }>; userErrors: readonly UserError[] };
}

const setMetafield = async (client: GraphqlClient, label: string, metafield: Record<string, unknown>) => {
  const { metafieldsSet } = await client<SetData>(SET_METAFIELDS, { metafields: [metafield] });
  assertNoUserErrors(label, metafieldsSet.userErrors);
  return metafieldsSet.metafields[0];
};

const CREATE_DEFINITION = `#graphql
  mutation CreateTrackedDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) { createdDefinition { id } userErrors { field message code } }
  }
`;

/** The flag must have a searchable definition for Shopify to filter products by it. Already existing is fine. */
const ensureFlagDefinition = async (client: GraphqlClient): Promise<void> => {
  const data = await client<{ metafieldDefinitionCreate: { userErrors: readonly UserError[] } }>(CREATE_DEFINITION, {
    definition: {
      name: 'Track inventory (ChocoTrack)',
      ...TRACKED_METAFIELD,
      ownerType: 'PRODUCT',
      type: 'boolean',
      capabilities: { adminFilterable: { enabled: true } },
    },
  });
  assertNoUserErrors('Create flag definition', data.metafieldDefinitionCreate.userErrors.filter((e) => e.code !== 'TAKEN'));
};

/** Flags or unflags a product for the Inventory report. */
export const setProductFlag = async (client: GraphqlClient, productId: string, tracked: boolean): Promise<void> => {
  if (tracked) await ensureFlagDefinition(client);
  await setMetafield(client, 'Flag product', { ownerId: productId, ...TRACKED_METAFIELD, type: 'boolean', value: String(tracked) });
};

export interface TargetsSave {
  readonly variantId: string;
  /** The full set of targets the variant should have; an empty set removes the metafield. */
  readonly targets: Targets;
  /** The digest the editor started from (null when the variant had no targets). A mismatch is refused. */
  readonly digest: string | null;
}

/** Saves a variant's targets, refusing to overwrite an edit made since the digest was read. */
export const saveVariantTargets = async (client: GraphqlClient, { variantId, targets, digest }: TargetsSave): Promise<{ digest: string | null }> => {
  const value = serializeTargets(targets);
  if (value === null) {
    const { metafieldsDelete } = await client<{ metafieldsDelete: { userErrors: readonly UserError[] } }>(DELETE_METAFIELDS, {
      metafields: [{ ownerId: variantId, ...TARGETS_METAFIELD }],
    });
    assertNoUserErrors('Remove targets', metafieldsDelete.userErrors);
    return { digest: null };
  }
  const saved = await setMetafield(client, 'Save targets', { ownerId: variantId, ...TARGETS_METAFIELD, type: 'json', value, compareDigest: digest });
  if (!saved) throw new ShopifyApiError('Shopify did not return the saved targets');
  return { digest: saved.compareDigest };
};

const CREATE_TRANSFER = `#graphql
  mutation CreateDraftTransfer($input: InventoryTransferCreateInput!, $key: String!) {
    inventoryTransferCreate(input: $input) @idempotent(key: $key) {
      inventoryTransfer { id status }
      userErrors { field message }
    }
  }
`;

export interface DraftTransferRequest {
  readonly originId: string;
  readonly destinationId: string;
  readonly lines: ReadonlyArray<{ readonly inventoryItemId: string; readonly quantity: number }>;
  /** One key per click, so a retry cannot create the draft twice. */
  readonly key: string;
}

/** A draft transfer in Shopify, tagged so the app can count it as "on the way". A person marks it ready. */
export const createDraftTransfer = async (client: GraphqlClient, req: DraftTransferRequest): Promise<{ id: string }> => {
  const data = await client<{ inventoryTransferCreate: { inventoryTransfer: { id: string } | null; userErrors: readonly UserError[] } }>(
    CREATE_TRANSFER,
    {
      key: req.key,
      input: {
        originLocationId: req.originId,
        destinationLocationId: req.destinationId,
        lineItems: req.lines.map(({ inventoryItemId, quantity }) => ({ inventoryItemId, quantity })),
        tags: [TRANSFER_TAG],
        referenceName: 'ChocoTrack suggestion',
        note: 'Suggested by ChocoTrack from the minimum and maximum targets. Review before marking ready.',
      },
    },
  );
  assertNoUserErrors('Create transfer', data.inventoryTransferCreate.userErrors);
  const transfer = data.inventoryTransferCreate.inventoryTransfer;
  if (!transfer) throw new ShopifyApiError('Shopify did not return the transfer');
  return { id: transfer.id };
};

/** Saves the ordered source locations with the app installation (no database). */
export const saveSourceIds = async (client: GraphqlClient, ids: readonly string[]): Promise<void> => {
  const { currentAppInstallation } = await client<{ currentAppInstallation: { id: string } }>(
    '#graphql\n query AppInstallationId { currentAppInstallation { id } }',
  );
  await setMetafield(client, 'Save source locations', {
    ownerId: currentAppInstallation.id,
    ...SOURCES_METAFIELD,
    type: 'json',
    value: JSON.stringify(ids),
  });
};

/** Free text plus an optional collection, in product-search syntax. Operators typed by people are stripped. */
export const buildProductQuery = (text: string, collectionId?: string): string | null => {
  const parts = [...(collectionId ? [`collection_id:${numericId(collectionId)}`] : []), ...(sanitize(text) ? [sanitize(text)] : [])];
  return parts.length > 0 ? parts.join(' AND ') : null;
};

const SEARCH_PRODUCTS = `#graphql
  query ProductsToFlag($query: String, $first: Int!) {
    products(first: $first, query: $query) {
      nodes {
        id
        title
        featuredMedia { preview { image { url } } }
        tracked: metafield(namespace: "${TRACKED_METAFIELD.namespace}", key: "${TRACKED_METAFIELD.key}") { value }
        variantsCount { count }
      }
    }
  }
`;

export interface FlagCandidate {
  readonly id: string;
  readonly title: string;
  readonly imageUrl?: string;
  readonly tracked: boolean;
  readonly variantCount: number;
}

export const searchProductsForFlag = async (
  client: GraphqlClient,
  { text = '', collectionId, first = 25 }: { text?: string; collectionId?: string; first?: number } = {},
): Promise<readonly FlagCandidate[]> => {
  const data = await client<{
    products: {
      nodes: ReadonlyArray<{
        id: string;
        title: string;
        featuredMedia: { preview: { image: { url: string } | null } | null } | null;
        tracked: { value: string } | null;
        variantsCount: { count: number } | null;
      }>;
    };
  }>(SEARCH_PRODUCTS, { query: buildProductQuery(text, collectionId), first });
  return data.products.nodes.map((n) => {
    const imageUrl = n.featuredMedia?.preview?.image?.url;
    return {
      id: n.id,
      title: n.title,
      ...(imageUrl ? { imageUrl } : {}),
      tracked: n.tracked?.value === 'true',
      variantCount: n.variantsCount?.count ?? 1,
    };
  });
};
