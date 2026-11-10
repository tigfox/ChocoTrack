import type { KitSize } from '../domain/types';
import { KIT_SIZE_METAFIELD, KIT_TAG, toCatalogVariant, type CatalogVariant, type VariantNode } from './catalog';
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
}

interface CreateKitData {
  productSet: {
    product: (VariantNode['product'] & { variants: { nodes: ReadonlyArray<Omit<VariantNode, 'product'>> } }) | null;
    userErrors: readonly UserError[];
  };
}

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
    metafields: [{ ...KIT_SIZE_METAFIELD, type: 'number_integer', value: String(kit.size) }],
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
