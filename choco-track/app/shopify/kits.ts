import type { KitSize } from '../domain/types';
import { CATEGORY_METAFIELD, KIT_SIZE_METAFIELD, KIT_TAG, toCatalogVariant, type CatalogVariant, type VariantNode } from './catalog';
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
        kitSize: metafield(namespace: "${KIT_SIZE_METAFIELD.namespace}", key: "${KIT_SIZE_METAFIELD.key}") { value }
        category: metafield(namespace: "${CATEGORY_METAFIELD.namespace}", key: "${CATEGORY_METAFIELD.key}") { value }
        variants(first: 1) { nodes { id title sku barcode image { url } inventoryItem { id } } }
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
  readonly title: string;
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
    metafields: [
      sizeMetafield(kit.size),
      ...(kit.categoryId ? [categoryMetafield(kit.categoryId)] : []),
    ],
    productOptions: [{ name: 'Title', position: 1, values: [{ name: 'Default Title' }] }],
    variants: [
      {
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
        sku: kit.sku,
        ...(kit.barcode ? { barcode: kit.barcode } : {}),
        price: kit.price ?? '0.00',
        inventoryItem: { tracked: true },
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

/** Edits an existing kit. The browser sends a variant id; it is only trusted once Shopify says it is a tagged kit. */
export const updateKit = async (client: GraphqlClient, update: KitUpdate): Promise<void> => {
  const found = await client<{ node: { product: { id: string; tags: readonly string[] } } | null }>(KIT_PRODUCT_QUERY, {
    id: update.variantId,
  });
  const product = found.node?.product;
  if (!product || !product.tags.includes(KIT_TAG)) throw new ShopifyUserErrors('Update kit', [NOT_A_KIT]);
  const { productUpdate } = await client<{ productUpdate: { userErrors: readonly UserError[] } }>(UPDATE_KIT_MUTATION, {
    product: {
      id: product.id,
      title: update.title,
      metafields: [sizeMetafield(update.size), ...(update.categoryId ? [categoryMetafield(update.categoryId)] : [])],
    },
  });
  assertNoUserErrors('Update kit', productUpdate.userErrors);
  if (update.categoryId !== null) return;
  const { metafieldsDelete } = await client<{ metafieldsDelete: { userErrors: readonly UserError[] } }>(DELETE_CATEGORY_MUTATION, {
    metafields: [{ ownerId: product.id, ...CATEGORY_METAFIELD }],
  });
  assertNoUserErrors('Update kit', metafieldsDelete.userErrors);
};
