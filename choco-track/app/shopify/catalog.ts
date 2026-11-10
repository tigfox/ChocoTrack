import type { Collection, KitSize, Variant } from '../domain/types';
import type { GraphqlClient } from './client';

/** Namespace/key of the product metafield that marks a product as a sampler kit and holds its size. */
export const KIT_SIZE_METAFIELD = { namespace: 'choco_track', key: 'kit_size' } as const;

const KIT_SIZES: readonly number[] = [4, 5, 6, 12];

/** A domain Variant plus the id Shopify needs for inventory calls. */
export interface CatalogVariant extends Variant {
  readonly inventoryItemId: string;
}

const VARIANT_FIELDS = `
  id
  title
  sku
  barcode
  image { url }
  inventoryItem { id }
  product {
    title
    featuredMedia { preview { image { url } } }
    collections(first: 25) { nodes { id } }
    kitSize: metafield(namespace: "${KIT_SIZE_METAFIELD.namespace}", key: "${KIT_SIZE_METAFIELD.key}") { value }
  }
`;

const SEARCH_QUERY = `#graphql
  query SearchVariants($query: String, $first: Int!) {
    productVariants(first: $first, query: $query) { nodes { ${VARIANT_FIELDS} } }
  }
`;

const BY_ID_QUERY = `#graphql
  query VariantsById($ids: [ID!]!) {
    nodes(ids: $ids) { ... on ProductVariant { ${VARIANT_FIELDS} } }
  }
`;

const COLLECTIONS_QUERY = `#graphql
  query Collections { collections(first: 100) { nodes { id title } } }
`;

export interface VariantNode {
  readonly id: string;
  readonly title: string;
  readonly sku: string | null;
  readonly barcode: string | null;
  readonly image: { readonly url: string } | null;
  readonly inventoryItem: { readonly id: string };
  readonly product: {
    readonly title: string;
    readonly featuredMedia: { readonly preview: { readonly image: { readonly url: string } | null } | null } | null;
    readonly collections: { readonly nodes: ReadonlyArray<{ readonly id: string }> };
    readonly kitSize: { readonly value: string } | null;
  };
}

const DEFAULT_VARIANT_TITLE = 'Default Title';

const parseKitSize = (raw: string | undefined): KitSize | undefined => {
  const n = Number(raw);
  return KIT_SIZES.includes(n) ? (n as KitSize) : undefined;
};

export const toCatalogVariant = (node: VariantNode): CatalogVariant => {
  const imageUrl = node.image?.url ?? node.product.featuredMedia?.preview?.image?.url;
  const kitSize = parseKitSize(node.product.kitSize?.value);
  return {
    id: node.id,
    inventoryItemId: node.inventoryItem.id,
    title: node.title === DEFAULT_VARIANT_TITLE ? node.product.title : `${node.product.title} - ${node.title}`,
    sku: node.sku ?? '',
    barcode: node.barcode ?? '',
    collectionIds: node.product.collections.nodes.map((c) => c.id),
    ...(imageUrl ? { imageUrl } : {}),
    ...(kitSize ? { kitSize } : {}),
  };
};

/** Shopify search syntax treats these as operators; users type names, SKUs and scanned barcodes. */
const OPERATORS = /^(and|or|not)$/i;

const sanitize = (text: string): string =>
  text
    .replace(/[^\p{L}\p{N}\s%.\-_]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/^-+/, ''))
    .filter((token) => token !== '' && !OPERATORS.test(token))
    .join(' ');

const numericId = (gid: string): string => gid.slice(gid.lastIndexOf('/') + 1);

/** Free text matches title, SKU prefix and exact barcode; `collection:` narrows to a collection. */
export const buildSearchQuery = (text: string, collectionId?: string): string | null => {
  const parts = [
    ...(collectionId ? [`collection:${numericId(collectionId)}`] : []),
    ...(sanitize(text) ? [sanitize(text)] : []),
  ];
  return parts.length > 0 ? parts.join(' AND ') : null;
};

export interface SearchOptions {
  readonly text?: string;
  readonly collectionId?: string;
  readonly first?: number;
}

export const searchVariants = async (
  client: GraphqlClient,
  { text = '', collectionId, first = 50 }: SearchOptions = {},
): Promise<readonly CatalogVariant[]> => {
  const data = await client<{ productVariants: { nodes: readonly VariantNode[] } }>(SEARCH_QUERY, {
    query: buildSearchQuery(text, collectionId),
    first,
  });
  return data.productVariants.nodes.map(toCatalogVariant);
};

/** Tag on every kit product; the kit-size metafield holds the size. */
export const KIT_TAG = 'choco-track-kit';

const KITS_QUERY = `#graphql
  query Kits {
    products(first: 50, query: "tag:${KIT_TAG}") {
      nodes {
        title
        featuredMedia { preview { image { url } } }
        collections(first: 25) { nodes { id } }
        kitSize: metafield(namespace: "${KIT_SIZE_METAFIELD.namespace}", key: "${KIT_SIZE_METAFIELD.key}") { value }
        variants(first: 10) { nodes { id title sku barcode image { url } inventoryItem { id } } }
      }
    }
  }
`;

type KitProductNode = VariantNode['product'] & {
  readonly variants: { readonly nodes: ReadonlyArray<Omit<VariantNode, 'product'>> };
};

export const listKits = async (client: GraphqlClient): Promise<readonly CatalogVariant[]> => {
  const data = await client<{ products: { nodes: readonly KitProductNode[] } }>(KITS_QUERY);
  return data.products.nodes
    .flatMap(({ variants, ...product }) => variants.nodes.map((v) => toCatalogVariant({ ...v, product })))
    .filter((v) => v.kitSize !== undefined);
};

export const listCollections = async (client: GraphqlClient): Promise<readonly Collection[]> => {
  const data = await client<{ collections: { nodes: ReadonlyArray<{ id: string; title: string }> } }>(COLLECTIONS_QUERY);
  return data.collections.nodes.map(({ id, title }) => ({ id, title }));
};

/** Looks variants up by id (the server never trusts inventory item ids or kit sizes sent by the browser). */
export const getVariants = async (client: GraphqlClient, ids: readonly string[]): Promise<readonly CatalogVariant[]> => {
  if (ids.length === 0) return [];
  const data = await client<{ nodes: ReadonlyArray<VariantNode | null> }>(BY_ID_QUERY, { ids });
  return data.nodes.filter((n): n is VariantNode => n !== null && n.inventoryItem !== undefined).map(toCatalogVariant);
};
