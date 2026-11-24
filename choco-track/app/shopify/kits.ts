import type { KitSize } from '../domain/types';
import { CATEGORY_METAFIELD, KIT_SIZE_METAFIELD, KIT_TAG, KIT_VARIANT_FIELDS, toCatalogVariant, type CatalogVariant, type VariantNode } from './catalog';
import type { GraphqlClient } from './client';
import { assertNoUserErrors, ShopifyApiError, ShopifyUserErrors, type UserError } from './errors';

const SKU_QUERY = `#graphql
  query SkuTaken($query: String!) { productVariants(first: 5, query: $query) { nodes { sku } } }
`;

const CREATE_KIT_MUTATION = `#graphql
  mutation CreateKit($input: ProductSetInput!) {
    productSet(synchronous: true, input: $input) {
      product {
        title
        featuredMedia { preview { image { url } } }
        collections(first: 25) { nodes { id } }
        variants(first: 1) { nodes { id title sku barcode image { url } ${KIT_VARIANT_FIELDS} inventoryItem { id } } }
      }
      userErrors { field message code }
    }
  }
`;

export interface NewKit {
  readonly title: string;
  readonly size: KitSize;
  readonly sku: string;
  readonly barcode?: string;
  /** Defaults to 0.00; the store team sets the real price in Shopify. */
  readonly price?: string;
  /** Collection the mix picker starts on. */
  readonly categoryId?: string;
}

/** The settings the store team can change on an existing kit. */
export interface KitUpdate {
  readonly variantId: string;
  /** Renames the PRODUCT (shared by all its variants). Leave out to keep the name. */
  readonly title?: string;
  readonly size: KitSize;
  /** null removes the category. */
  readonly categoryId: string | null;
}

interface CreateKitData {
  productSet: {
    product: (VariantNode['product'] & { variants: { nodes: ReadonlyArray<Omit<VariantNode, 'product'>> } }) | null;
    userErrors: readonly UserError[];
  };
}

const sizeMetafield = (size: KitSize) => ({ ...KIT_SIZE_METAFIELD, type: 'number_integer', value: String(size) });
const categoryMetafield = (id: string) => ({ ...CATEGORY_METAFIELD, type: 'collection_reference', value: id });

const skuTaken = async (client: GraphqlClient, sku: string): Promise<boolean> => {
  const query = `sku:"${sku.replace(/["\\]/g, '')}"`;
  const data = await client<{ productVariants: { nodes: ReadonlyArray<{ sku: string | null }> } }>(SKU_QUERY, { query });
  return data.productVariants.nodes.some((v) => v.sku?.toLowerCase() === sku.toLowerCase());
};

/** A tracked, tagged product with one variant. Stock is added by the first assembly. */
export const createKit = async (client: GraphqlClient, kit: NewKit): Promise<CatalogVariant> => {
  if (await skuTaken(client, kit.sku)) throw new ShopifyUserErrors('Create kit', [{ message: 'That SKU is already in use.' }]);
  const input = {
    title: kit.title,
    status: 'ACTIVE',
    tags: [KIT_TAG],
    productOptions: [{ name: 'Title', position: 1, values: [{ name: 'Default Title' }] }],
    variants: [
      {
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
        sku: kit.sku,
        ...(kit.barcode ? { barcode: kit.barcode } : {}),
        price: kit.price ?? '0.00',
        inventoryItem: { tracked: true },
        metafields: [sizeMetafield(kit.size), ...(kit.categoryId ? [categoryMetafield(kit.categoryId)] : [])],
      },
    ],
  };
  const { productSet } = await client<CreateKitData>(CREATE_KIT_MUTATION, { input });
  assertNoUserErrors('Create kit', productSet.userErrors);
  const { variants, ...product } = productSet.product ?? {};
  const variant = variants?.nodes[0];
  if (!variant) throw new ShopifyApiError('Shopify did not return the new kit');
  return toCatalogVariant({ ...variant, product: product as VariantNode['product'] });
};

const SET_METAFIELDS_MUTATION = `#graphql
  mutation SetKitMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) { metafields { key } userErrors { field message } }
  }
`;

const KIT_PRODUCT_QUERY = `#graphql
  query KitProduct($id: ID!) { node(id: $id) { ... on ProductVariant { product { id tags } } } }
`;

const UPDATE_KIT_MUTATION = `#graphql
  mutation UpdateKit($product: ProductUpdateInput!) {
    productUpdate(product: $product) { product { id } userErrors { field message } }
  }
`;

const DELETE_CATEGORY_MUTATION = `#graphql
  mutation RemoveCategory($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) { deletedMetafields { key } userErrors { field message } }
  }
`;

const NOT_A_KIT: UserError = { message: 'That item is not a kit.' };

/** Writes the kit size, and the category (or removes it), on the variant. */
const writeKitSettings = async (client: GraphqlClient, variantId: string, size: KitSize, categoryId: string | null): Promise<void> => {
  const owned = (m: Record<string, string>) => ({ ownerId: variantId, ...m });
  const { metafieldsSet } = await client<{ metafieldsSet: { userErrors: readonly UserError[] } }>(SET_METAFIELDS_MUTATION, {
    metafields: [sizeMetafield(size), ...(categoryId ? [categoryMetafield(categoryId)] : [])].map(owned),
  });
  assertNoUserErrors('Update kit', metafieldsSet.userErrors);
  if (categoryId !== null) return;
  const { metafieldsDelete } = await client<{ metafieldsDelete: { userErrors: readonly UserError[] } }>(DELETE_CATEGORY_MUTATION, {
    metafields: [owned(CATEGORY_METAFIELD)],
  });
  assertNoUserErrors('Update kit', metafieldsDelete.userErrors);
};

/**
 * Edits an existing kit: the size and category live on the variant, the name on the product (renamed only when `title` is given).
 * The browser sends a variant id; it is only trusted once Shopify says its product is a tagged kit.
 */
export const updateKit = async (client: GraphqlClient, update: KitUpdate): Promise<void> => {
  const found = await client<{ node: { product: { id: string; tags: readonly string[] } } | null }>(KIT_PRODUCT_QUERY, {
    id: update.variantId,
  });
  const product = found.node?.product;
  if (!product || !product.tags.includes(KIT_TAG)) throw new ShopifyUserErrors('Update kit', [NOT_A_KIT]);
  // The failure-prone writes come first, so a failure never leaves a renamed product with old settings.
  await writeKitSettings(client, update.variantId, update.size, update.categoryId);
  if (update.title === undefined) return;
  const { productUpdate } = await client<{ productUpdate: { userErrors: readonly UserError[] } }>(UPDATE_KIT_MUTATION, {
    product: { id: product.id, title: update.title },
  });
  assertNoUserErrors('Update kit', productUpdate.userErrors);
};

/** An existing variant to use as a kit (for example a product the store already sells as a sampler box). */
export interface KitLink {
  readonly variantId: string;
  readonly size: KitSize;
  /** null means no category. */
  readonly categoryId: string | null;
}

const LINK_LOOKUP_QUERY = `#graphql
  query LinkKit($id: ID!) {
    node(id: $id) { ... on ProductVariant { title inventoryItem { tracked } product { id title tags } } }
  }
`;

const TAGS_ADD_MUTATION = `#graphql
  mutation TagKit($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }
`;

const DEFAULT_VARIANT_TITLE = 'Default Title';

/**
 * Makes an existing variant a kit: writes the size (and category) on the variant, then tags its product.
 * Refuses a variant that does not track inventory, because assembling adds stock to it. Returns the kit's display name.
 */
export const linkKit = async (client: GraphqlClient, link: KitLink): Promise<string> => {
  const found = await client<{
    node: { title?: string; inventoryItem?: { tracked: boolean }; product?: { id: string; title: string; tags: readonly string[] } } | null;
  }>(LINK_LOOKUP_QUERY, { id: link.variantId });
  const variant = found.node;
  if (!variant?.product || !variant.inventoryItem) throw new ShopifyUserErrors('Link kit', [{ message: 'That product was not found.' }]);
  if (!variant.inventoryItem.tracked) {
    throw new ShopifyUserErrors('Link kit', [{ message: 'Turn on inventory tracking for that product in Shopify first, then add it as a kit.' }]);
  }
  const { product } = variant;
  // Metafields first: if they fail nothing else has changed. Tagging last is what makes the kit appear in the list.
  await writeKitSettings(client, link.variantId, link.size, link.categoryId);
  if (!product.tags.includes(KIT_TAG)) {
    const { tagsAdd } = await client<{ tagsAdd: { userErrors: readonly UserError[] } }>(TAGS_ADD_MUTATION, { id: product.id, tags: [KIT_TAG] });
    assertNoUserErrors('Link kit', tagsAdd.userErrors);
  }
  return variant.title === undefined || variant.title === DEFAULT_VARIANT_TITLE ? product.title : `${product.title} - ${variant.title}`;
};
