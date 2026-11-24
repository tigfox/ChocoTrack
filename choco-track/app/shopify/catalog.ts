import { parseKitSize } from '../domain/kitSize';
import { humanizeFlavor, isFlavorSlug } from '../lib/flavorName';
import type { Collection, StockMap, Variant } from '../domain/types';
import type { GraphqlClient } from './client';

/** Namespace/key of the VARIANT metafield that marks a variant as a sampler kit and holds its size. */
export const KIT_SIZE_METAFIELD = { namespace: 'choco_track', key: 'kit_size' } as const;

/** Optional variant metafield: the name to show for a flavor (set by the importer; staff can edit it in Shopify). */
export const DISPLAY_NAME_METAFIELD = { namespace: 'choco_track', key: 'display_name' } as const;

/** Optional kit setting on the variant: the collection (category) the mix picker starts on. */
export const CATEGORY_METAFIELD = { namespace: 'choco_track', key: 'category' } as const;


/** A domain Variant plus the id Shopify needs for inventory calls. */
export interface CatalogVariant extends Variant {
  readonly inventoryItemId: string;
}

/** The kit settings, read from the variant (a product such as "Mini Bars (Assorted)" can hold kits of different sizes). */
export const KIT_VARIANT_FIELDS = `
  kitSize: metafield(namespace: "${KIT_SIZE_METAFIELD.namespace}", key: "${KIT_SIZE_METAFIELD.key}") { value }
  category: metafield(namespace: "${CATEGORY_METAFIELD.namespace}", key: "${CATEGORY_METAFIELD.key}") { value }`;

/** Stock rides along with every variant read, so no second round trip is needed. */
const INVENTORY_ITEM = `inventoryItem {
    id
    inventoryLevels(first: 50) { nodes { location { id } quantities(names: ["available"]) { quantity } } }
  }`;

const VARIANT_FIELDS = `
  id
  title
  sku
  barcode
  image { url }
  displayName: metafield(namespace: "${DISPLAY_NAME_METAFIELD.namespace}", key: "${DISPLAY_NAME_METAFIELD.key}") { value }
  ${KIT_VARIANT_FIELDS}
  ${INVENTORY_ITEM}
  product {
    title
    featuredMedia { preview { image { url } } }
    collections(first: 25) { nodes { id } }
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
  /** Kit settings from the variant's metafields; absent or null for an ordinary variant. */
  readonly displayName?: { readonly value: string } | null;
  readonly kitSize?: { readonly value: string } | null;
  readonly category?: { readonly value: string } | null;
  readonly inventoryItem: {
    readonly id: string;
    /** Absent when the node was fetched without stock (for example right after creating a kit). */
    readonly inventoryLevels?: {
      readonly nodes: ReadonlyArray<{
        readonly location: { readonly id: string };
        readonly quantities: ReadonlyArray<{ readonly quantity: number }>;
      }>;
    };
  };
  readonly product: {
    readonly title: string;
    readonly featuredMedia: { readonly preview: { readonly image: { readonly url: string } | null } | null } | null;
    readonly collections: { readonly nodes: ReadonlyArray<{ readonly id: string }> };
  };
}

/** Variants plus their available quantity per location (a missing location means "not stocked there"). */
export interface CatalogResult {
  readonly variants: readonly CatalogVariant[];
  readonly stock: StockMap;
}

const nodeStock = (node: VariantNode): StockMap => {
  const levels = node.inventoryItem.inventoryLevels?.nodes;
  return levels
    ? { [node.id]: Object.fromEntries(levels.map((l) => [l.location.id, l.quantities[0]?.quantity ?? 0])) }
    : {};
};

const toResult = (nodes: readonly VariantNode[]): CatalogResult => ({
  variants: nodes.map(toCatalogVariant),
  stock: Object.assign({}, ...nodes.map(nodeStock)) as StockMap,
});

const DEFAULT_VARIANT_TITLE = 'Default Title';

/** Category products are titled "Mini Bars - Rare"; their variants are the flavors. */
const CATEGORY_PRODUCT_PREFIX = /^Mini Bars - /i;

/** The category product's title without the shared prefix ("Mini Bars - Rare" becomes "Rare"). */
const groupLabel = (productTitle: string): string => productTitle.replace(CATEGORY_PRODUCT_PREFIX, '');

export const toCatalogVariant = (node: VariantNode): CatalogVariant => {
  const imageUrl = node.image?.url ?? node.product.featuredMedia?.preview?.image?.url;
  const kitSize = parseKitSize(node.kitSize?.value);
  const categoryId = node.category?.value;
  const isDefault = node.title === DEFAULT_VARIANT_TITLE;
  // A flavor: the display name, else (for a category product only) the humanized slug. Anything else keeps "Product - Variant",
  // so a variant named "12" or "6-pack" on an ordinary product is not renamed.
  const isCategoryFlavor = !isDefault && CATEGORY_PRODUCT_PREFIX.test(node.product.title) && isFlavorSlug(node.title);
  const flavor = node.displayName?.value || (isCategoryFlavor ? humanizeFlavor(node.title) : undefined);
  return {
    id: node.id,
    inventoryItemId: node.inventoryItem.id,
    title: flavor ?? (isDefault ? node.product.title : `${node.product.title} - ${node.title}`),
    sku: node.sku ?? '',
    barcode: node.barcode ?? '',
    collectionIds: node.product.collections.nodes.map((c) => c.id),
    ...(flavor && !isDefault ? { group: groupLabel(node.product.title) } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(kitSize ? { kitSize } : {}),
    ...(categoryId ? { categoryId } : {}),
  };
};

/** Shopify search syntax treats these as operators; users type names, SKUs and scanned barcodes. */
const OPERATORS = /^(and|or|not)$/i;

export const sanitize = (text: string): string =>
  text
    .replace(/[^\p{L}\p{N}\s%.\-_]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/^-+/, ''))
    .filter((token) => token !== '' && !OPERATORS.test(token))
    .join(' ');

export const numericId = (gid: string): string => gid.slice(gid.lastIndexOf('/') + 1);

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
): Promise<CatalogResult> => {
  const data = await client<{ productVariants: { nodes: readonly VariantNode[] } }>(SEARCH_QUERY, {
    query: buildSearchQuery(text, collectionId),
    first,
  });
  return toResult(data.productVariants.nodes);
};

/** Tag on every kit product; the kit-size metafield holds the size. */
export const KIT_TAG = 'choco-track-kit';

/** Kept at 10: the query also reads stock levels per variant, and 50 variants would exceed Shopify's query cost limit. */
const KIT_VARIANTS_PER_PRODUCT = 10;

const KITS_QUERY = `#graphql
  query Kits {
    products(first: 50, query: "tag:${KIT_TAG}") {
      nodes {
        title
        featuredMedia { preview { image { url } } }
        collections(first: 25) { nodes { id } }
        variants(first: ${KIT_VARIANTS_PER_PRODUCT}) {
          nodes { id title sku barcode image { url } ${KIT_VARIANT_FIELDS} ${INVENTORY_ITEM} }
        }
      }
    }
  }
`;

type KitProductNode = VariantNode['product'] & {
  readonly variants: { readonly nodes: ReadonlyArray<Omit<VariantNode, 'product'>> };
};

export const listKits = async (client: GraphqlClient): Promise<CatalogResult> => {
  const data = await client<{ products: { nodes: readonly KitProductNode[] } }>(KITS_QUERY);
  const all = toResult(data.products.nodes.flatMap(({ variants, ...product }) => variants.nodes.map((v) => ({ ...v, product }))));
  const variants = all.variants.filter((v) => v.kitSize !== undefined);
  const stock: StockMap = Object.fromEntries(
    variants.flatMap((v): [string, Readonly<Record<string, number>>][] => {
      const levels = all.stock[v.id];
      return levels ? [[v.id, levels]] : [];
    }),
  );
  return { variants, stock };
};

export const listCollections = async (client: GraphqlClient): Promise<readonly Collection[]> => {
  const data = await client<{ collections: { nodes: ReadonlyArray<{ id: string; title: string }> } }>(COLLECTIONS_QUERY);
  return data.collections.nodes.map(({ id, title }) => ({ id, title }));
};

/** Looks variants up by id (the server never trusts inventory item ids or kit sizes sent by the browser). */
export const getVariants = async (client: GraphqlClient, ids: readonly string[]): Promise<CatalogResult> => {
  if (ids.length === 0) return { variants: [], stock: {} };
  const data = await client<{ nodes: ReadonlyArray<VariantNode | null> }>(BY_ID_QUERY, { ids });
  return toResult(data.nodes.filter((n): n is VariantNode => n !== null && n.inventoryItem !== undefined));
};
