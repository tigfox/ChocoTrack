import { fakeClient } from './fakeClient';
import { createKit, updateKit } from './kits';

const product = {
  title: 'Sampler Kit - 5 Pack',
  featuredMedia: null,
  collections: { nodes: [] },
  kitSize: { value: '5' },
  variants: { nodes: [{ id: 'v1', title: 'Default Title', sku: 'SMP-5', barcode: null, image: null, inventoryItem: { id: 'i1' } }] },
};

const noSku = { productVariants: { nodes: [] } };

describe('createKit', () => {
  it('creates a tracked, tagged product with the size metafield', async () => {
    const client = fakeClient(noSku, { productSet: { product, userErrors: [] } });
    const kit = await createKit(client, { title: 'Sampler Kit - 5 Pack', size: 5, sku: 'SMP-5', price: '17.00' });
    expect(kit).toMatchObject({ id: 'v1', inventoryItemId: 'i1', sku: 'SMP-5', kitSize: 5, title: 'Sampler Kit - 5 Pack' });
    const input = (client.calls[1]?.variables as { input: { tags: string[]; metafields: unknown[]; variants: Record<string, unknown>[] } }).input;
    expect(input.tags).toEqual(['choco-track-kit']);
    expect(input.metafields).toEqual([{ namespace: 'choco_track', key: 'kit_size', type: 'number_integer', value: '5' }]);
    expect(input.variants[0]).toMatchObject({ sku: 'SMP-5', price: '17.00', inventoryItem: { tracked: true } });
  });
  it('defaults the price and omits an empty barcode', async () => {
    const client = fakeClient(noSku, { productSet: { product, userErrors: [] } });
    await createKit(client, { title: 'K', size: 5, sku: 'S' });
    const variant = (client.calls[1]?.variables as { input: { variants: Record<string, unknown>[] } }).input.variants[0];
    expect(variant?.price).toBe('0.00');
    expect(variant).not.toHaveProperty('barcode');
  });
  it('throws on user errors, such as a duplicate SKU', async () => {
    const client = fakeClient(noSku, { productSet: { product: null, userErrors: [{ message: 'SKU taken' }] } });
    await expect(createKit(client, { title: 'K', size: 4, sku: 'S' })).rejects.toThrow('SKU taken');
  });
  it('throws when no product comes back', async () => {
    const client = fakeClient(noSku, { productSet: { product: null, userErrors: [] } });
    await expect(createKit(client, { title: 'K', size: 4, sku: 'S' })).rejects.toThrow('did not return');
  });
  it('refuses a SKU that already exists (case-insensitive) without creating anything', async () => {
    const client = fakeClient({ productVariants: { nodes: [{ sku: 'smp-5' }, { sku: null }] } });
    await expect(createKit(client, { title: 'K', size: 5, sku: 'SMP-5' })).rejects.toThrow('That SKU is already in use.');
    expect(client.calls).toHaveLength(1);
  });
  it('searches for the exact SKU, stripping quote characters', async () => {
    const client = fakeClient({ productVariants: { nodes: [{ sku: 'OTHER' }] } }, { productSet: { product, userErrors: [] } });
    await createKit(client, { title: 'K', size: 5, sku: 'A"B\\' });
    expect(client.calls[0]?.variables).toEqual({ query: 'sku:"AB"' });
  });
});

describe('createKit category', () => {
  it('stores the category as a collection reference', async () => {
    const client = fakeClient(noSku, { productSet: { product, userErrors: [] } });
    await createKit(client, { title: 'K', size: 5, sku: 'S', categoryId: 'gid://shopify/Collection/7' });
    const input = (client.calls[1]?.variables as { input: { metafields: unknown[] } }).input;
    expect(input.metafields).toContainEqual({ namespace: 'choco_track', key: 'category', type: 'collection_reference', value: 'gid://shopify/Collection/7' });
  });
});

describe('updateKit', () => {
  const kitProduct = { node: { product: { id: 'gid://shopify/Product/1', tags: ['choco-track-kit'] } } };
  const ok = { productUpdate: { product: { id: 'gid://shopify/Product/1' }, userErrors: [] } };
  const edit = { variantId: 'gid://shopify/ProductVariant/1', title: 'New name', size: 12 as const };

  it('updates title, size and category on the product', async () => {
    const client = fakeClient(kitProduct, ok);
    await updateKit(client, { ...edit, categoryId: 'gid://shopify/Collection/7' });
    const input = (client.calls[1]?.variables as { product: Record<string, unknown> }).product;
    expect(input).toEqual({
      id: 'gid://shopify/Product/1',
      title: 'New name',
      metafields: [
        { namespace: 'choco_track', key: 'kit_size', type: 'number_integer', value: '12' },
        { namespace: 'choco_track', key: 'category', type: 'collection_reference', value: 'gid://shopify/Collection/7' },
      ],
    });
    expect(client.calls).toHaveLength(2);
  });
  it('removes the category when none is chosen', async () => {
    const client = fakeClient(kitProduct, ok, { metafieldsDelete: { deletedMetafields: [], userErrors: [] } });
    await updateKit(client, { ...edit, categoryId: null });
    const input = (client.calls[1]?.variables as { product: { metafields: { key: string }[] } }).product;
    expect(input.metafields.map((m) => m.key)).toEqual(['kit_size']);
    expect(client.calls[2]?.variables).toEqual({
      metafields: [{ ownerId: 'gid://shopify/Product/1', namespace: 'choco_track', key: 'category' }],
    });
  });
  it('refuses to edit a product that is not a kit', async () => {
    const client = fakeClient({ node: { product: { id: 'p', tags: ['other'] } } });
    await expect(updateKit(client, { ...edit, categoryId: null })).rejects.toThrow('That item is not a kit.');
    expect(client.calls).toHaveLength(1);
  });
  it('refuses an id that is not a variant', async () => {
    const client = fakeClient({ node: null });
    await expect(updateKit(client, { ...edit, categoryId: null })).rejects.toThrow('That item is not a kit.');
  });
  it('surfaces user errors from either write', async () => {
    const bad = { productUpdate: { product: null, userErrors: [{ message: 'Nope' }] } };
    await expect(updateKit(fakeClient(kitProduct, bad), { ...edit, categoryId: null })).rejects.toThrow('Nope');
    const badDelete = { metafieldsDelete: { deletedMetafields: [], userErrors: [{ message: 'Cannot delete' }] } };
    await expect(updateKit(fakeClient(kitProduct, ok, badDelete), { ...edit, categoryId: null })).rejects.toThrow('Cannot delete');
  });
});
