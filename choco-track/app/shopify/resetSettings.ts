import { DEFAULT_PACK_SIZES } from '../domain/packSizes';
import { DEFAULT_SETUP } from '../domain/setup';
import { chunk } from './batch';
import type { GraphqlClient } from './client';
import { assertNoUserErrors, type UserError } from './errors';
import { savePackSizes, saveSetup, saveSourceIds } from './inventoryWrites';
import { loadProducts, TARGETS_METAFIELD, TRACKED_METAFIELD, UNTRACKED_METAFIELD } from './trackedCatalog';

const PAGE = 250;
/** Products read per reset: 8 pages of 250. A larger catalog is reset in part and the person is told. */
const MAX_PAGES = 8;
/** `metafieldsDelete` takes at most 250 identifiers. */
const DELETE_BATCH = 250;

const ALL_PRODUCT_IDS = `#graphql
  query AllProductIds($after: String) {
    products(first: ${PAGE}, after: $after) {
      nodes { id }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const DELETE = `#graphql
  mutation DeleteMetafields($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) { deletedMetafields { key } userErrors { field message } }
  }
`;

interface IdPage {
  products: { nodes: ReadonlyArray<{ id: string }>; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
}

const readProductIds = async (client: GraphqlClient): Promise<{ ids: readonly string[]; more: boolean }> => {
  const readPage = async (after: string | null, page: number, found: readonly string[]): Promise<{ ids: readonly string[]; more: boolean }> => {
    const data = await client<IdPage>(ALL_PRODUCT_IDS, { after });
    const ids = [...found, ...data.products.nodes.map((n) => n.id)];
    const { hasNextPage, endCursor } = data.products.pageInfo;
    if (!hasNextPage) return { ids, more: false };
    return page < MAX_PAGES ? readPage(endCursor, page + 1, ids) : { ids, more: true };
  };
  return readPage(null, 1, []);
};

interface Identifier {
  readonly ownerId: string;
  readonly namespace: string;
  readonly key: string;
}

const deleteAll = async (client: GraphqlClient, identifiers: readonly Identifier[]): Promise<void> => {
  for (const batch of chunk(identifiers, DELETE_BATCH)) {
    const { metafieldsDelete } = await client<{ metafieldsDelete: { userErrors: readonly UserError[] } }>(DELETE, { metafields: batch });
    assertNoUserErrors('Reset settings', metafieldsDelete.userErrors);
  }
};

export interface ResetResult {
  /** Products whose tracked flag was cleared. */
  readonly products: number;
  /** Variants whose targets or Untracked switch were cleared. */
  readonly variants: number;
  /** Products with more variants than one read covers; the rest of their variants were not touched. */
  readonly truncatedProducts: number;
  /** The catalog was larger than one reset reads; run it again to clear the rest. */
  readonly moreProducts: boolean;
}

/**
 * Puts the store back to a first-time state, keeping products, inventory, kits and collections: no flagged products, no
 * targets, no Untracked switches, no transfer sources, default pack sizes, and the setup guide not complete.
 * The guide is set back first, so a failure part-way leaves alerts off, never half-reset alerts on.
 */
export const resetAllSettings = async (client: GraphqlClient): Promise<ResetResult> => {
  await saveSetup(client, DEFAULT_SETUP);
  const { ids, more } = await readProductIds(client);
  const products = await loadProducts(client, ids);
  const variantIdentifiers = products.flatMap((p) =>
    p.variants.flatMap((v) => [
      ...(Object.keys(v.targets).length > 0 ? [{ ownerId: v.id, ...TARGETS_METAFIELD }] : []),
      ...(v.untracked === true ? [{ ownerId: v.id, ...UNTRACKED_METAFIELD }] : []),
    ]),
  );
  // Deleting a flag that is not there is harmless, so every product is cleared rather than trusting Shopify's lagging search.
  await deleteAll(client, [...ids.map((id) => ({ ownerId: id, ...TRACKED_METAFIELD })), ...variantIdentifiers]);
  await saveSourceIds(client, []);
  await savePackSizes(client, DEFAULT_PACK_SIZES);
  return {
    products: ids.length,
    variants: new Set(variantIdentifiers.map((i) => i.ownerId)).size,
    truncatedProducts: products.filter((p) => p.truncated).length,
    moreProducts: more,
  };
};
