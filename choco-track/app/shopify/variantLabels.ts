import { chunk } from './batch';
import { DISPLAY_NAME_METAFIELD, variantNames } from './catalog';
import type { GraphqlClient } from './client';

export interface VariantLabel {
  readonly title: string;
  readonly sku: string;
  /** For flavors of a category product: the category, shown under the name. */
  readonly group?: string;
}

const LABEL_BATCH = 100;

const LABELS_QUERY = `#graphql
  query VariantLabels($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        sku
        displayName: metafield(namespace: "${DISPLAY_NAME_METAFIELD.namespace}", key: "${DISPLAY_NAME_METAFIELD.key}") { value }
        product { title }
      }
    }
  }
`;

interface LabelNode {
  readonly id?: string;
  readonly title: string;
  readonly sku: string | null;
  readonly displayName: { readonly value: string } | null;
  readonly product: { readonly title: string };
}

/** Names and SKUs for variant ids (no stock, so it is cheap for hundreds of ids). Ids that no longer exist are left out. */
export const loadVariantLabels = async (client: GraphqlClient, ids: readonly string[]): Promise<Readonly<Record<string, VariantLabel>>> => {
  const pages = await Promise.all(chunk(ids, LABEL_BATCH).map((batch) => client<{ nodes: ReadonlyArray<LabelNode | null> }>(LABELS_QUERY, { ids: batch })));
  return Object.fromEntries(
    pages
      .flatMap((p) => p.nodes)
      .filter((n): n is LabelNode & { id: string } => n !== null && n.id !== undefined && n.product !== undefined)
      .map((n) => [n.id, { ...variantNames(n), sku: n.sku ?? '' }]),
  );
};
