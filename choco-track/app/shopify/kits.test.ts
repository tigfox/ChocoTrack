import { fakeClient } from './fakeClient';
import { createKit, linkKit, updateKit } from './kits';

const product = {
  title: 'Sampler Kit - 5 Pack',
  featuredMedia: null,
  collections: { nodes: [] },
  variants: { nodes: [{ id: 'v1', title: 'Default Title', sku: 'SMP-5', barcode: null, image: null, inventoryItem: { id: 'i1' }, kitSize: { value: '5' } }] },
};

const noSku = { productVariants: { nodes: [] } };

describe('createKit', () => {
  it('creates a tracked, tagged product with the size metafield on its variant', async () => {
    const client = fakeClient(noSku, { productSet: { product, userErrors: [] } });
    const kit = await createKit(client, { title: 'Sampler Kit - 5 Pack', size: 5, sku: 'SMP-5', price: '17.00' });
    expect(kit).toMatchObject({ id: 'v1', inventoryItemId: 'i1', sku: 'SMP-5', kitSize: 5, title: 'Sampler Kit - 5 Pack' });
    const input = (client.calls[1]?.variables as { input: { tags: string[]; metafields?: unknown; variants: Record<string, unknown>[] } }).input;
    expect(input.tags).toEqual(['choco-track-kit']);
    expect(input).not.toHaveProperty('metafields');
    expect(input.variants[0]).toMatchObject({
      sku: 'SMP-5',
      price: '17.00',
      inventoryItem: { tracked: true },
      metafields: [{ namespace: 'choco_track', key: 'kit_size', type: 'number_integer', value: '5' }],
    });
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
    const input = (client.calls[1]?.variables as { input: { variants: { metafields: unknown[] }[] } }).input;
    expect(input.variants[0]?.metafields).toContainEqual({ namespace: 'choco_track', key: 'category', type: 'collection_reference', value: 'gid://shopify/Collection/7' });
  });
});

describe('updateKit', () => {
  const kitProduct = { node: { product: { id: 'gid://shopify/Product/1', tags: ['choco-track-kit'] } } };
  const renamed = { productUpdate: { product: { id: 'gid://shopify/Product/1' }, userErrors: [] } };
  const written = { metafieldsSet: { metafields: [{ key: 'kit_size' }], userErrors: [] } };
  const removed = { metafieldsDelete: { deletedMetafields: [], userErrors: [] } };
  const variantId = 'gid://shopify/ProductVariant/1';
  const edit = { variantId, title: 'New name', size: 12 as const };

  it('writes size and category on the variant, then renames the product', async () => {
    const client = fakeClient(kitProduct, written, renamed);
    await updateKit(client, { ...edit, categoryId: 'gid://shopify/Collection/7' });
    expect(client.calls[1]?.variables).toEqual({
      metafields: [
        { ownerId: variantId, namespace: 'choco_track', key: 'kit_size', type: 'number_integer', value: '12' },
        { ownerId: variantId, namespace: 'choco_track', key: 'category', type: 'collection_reference', value: 'gid://shopify/Collection/7' },
      ],
    });
    expect(client.calls[2]?.variables).toEqual({ product: { id: 'gid://shopify/Product/1', title: 'New name' } });
    expect(client.calls).toHaveLength(3);
  });
  it('does not touch the product when no new name is given', async () => {
    const client = fakeClient(kitProduct, written);
    await updateKit(client, { variantId, size: 12, categoryId: 'gid://shopify/Collection/7' });
    expect(client.calls).toHaveLength(2);
    expect(client.calls.some((c) => c.query.includes('productUpdate'))).toBe(false);
  });
  it('removes the variant category when none is chosen', async () => {
    const client = fakeClient(kitProduct, written, removed, renamed);
    await updateKit(client, { ...edit, categoryId: null });
    const sent = (client.calls[1]?.variables as { metafields: { key: string }[] }).metafields;
    expect(sent.map((m) => m.key)).toEqual(['kit_size']);
    expect(client.calls[2]?.variables).toEqual({ metafields: [{ ownerId: variantId, namespace: 'choco_track', key: 'category' }] });
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
  it('surfaces user errors from each write, and does not rename when the metafields fail', async () => {
    const badSet = { metafieldsSet: { metafields: [], userErrors: [{ message: 'Bad value' }] } };
    const failing = fakeClient(kitProduct, badSet);
    await expect(updateKit(failing, { ...edit, categoryId: null })).rejects.toThrow('Bad value');
    expect(failing.calls).toHaveLength(2);
    const badDelete = { metafieldsDelete: { deletedMetafields: [], userErrors: [{ message: 'Cannot delete' }] } };
    await expect(updateKit(fakeClient(kitProduct, written, badDelete), { ...edit, categoryId: null })).rejects.toThrow('Cannot delete');
    const badRename = { productUpdate: { product: null, userErrors: [{ message: 'Nope' }] } };
    await expect(updateKit(fakeClient(kitProduct, written, badRename), { ...edit, categoryId: 'gid://shopify/Collection/7' })).rejects.toThrow('Nope');
  });
});

describe('linkKit', () => {
  const variantId = 'gid://shopify/ProductVariant/9';
  const found = (over: Record<string, unknown> = {}) => ({
    node: { title: 'Default Title', product: { id: 'gid://shopify/Product/5', title: '12 Bar Mini Sampler Box', tags: ['Gifts'] }, inventoryItem: { tracked: true }, ...over },
  });
  const tagged = { tagsAdd: { userErrors: [] } };
  const written = { metafieldsSet: { metafields: [{ key: 'kit_size' }], userErrors: [] } };
  const removed = { metafieldsDelete: { deletedMetafields: [], userErrors: [] } };
  const link = { variantId, size: 12 as const, categoryId: 'gid://shopify/Collection/7' };

  it('writes size and category on the variant, then tags the product', async () => {
    const client = fakeClient(found(), written, tagged);
    await expect(linkKit(client, link)).resolves.toBe('12 Bar Mini Sampler Box');
    expect(client.calls[2]?.variables).toEqual({ id: 'gid://shopify/Product/5', tags: ['choco-track-kit'] });
    expect(client.calls[1]?.variables).toEqual({
      metafields: [
        { ownerId: variantId, namespace: 'choco_track', key: 'kit_size', type: 'number_integer', value: '12' },
        { ownerId: variantId, namespace: 'choco_track', key: 'category', type: 'collection_reference', value: 'gid://shopify/Collection/7' },
      ],
    });
    expect(client.calls).toHaveLength(3);
  });
  it('names a variant of a multi-variant product', async () => {
    const client = fakeClient(found({ title: '4 Minis (Mix)' }), written, tagged);
    await expect(linkKit(client, link)).resolves.toBe('12 Bar Mini Sampler Box - 4 Minis (Mix)');
  });
  it('does not tag a product that already carries the kit tag', async () => {
    const client = fakeClient(found({ product: { id: 'p', title: 'T', tags: ['choco-track-kit'] } }), written);
    await linkKit(client, link);
    expect(client.calls).toHaveLength(2);
  });
  it('clears a previous category when none is chosen', async () => {
    const client = fakeClient(found(), written, removed, tagged);
    await linkKit(client, { ...link, categoryId: null });
    expect(client.calls[2]?.variables).toEqual({ metafields: [{ ownerId: variantId, namespace: 'choco_track', key: 'category' }] });
  });
  it('refuses a variant that does not exist', async () => {
    const client = fakeClient({ node: null });
    await expect(linkKit(client, link)).rejects.toThrow('That product was not found.');
    expect(client.calls).toHaveLength(1);
  });
  it('refuses a variant that does not track inventory, without changing anything', async () => {
    const client = fakeClient(found({ inventoryItem: { tracked: false } }));
    await expect(linkKit(client, link)).rejects.toThrow('Turn on inventory tracking');
    expect(client.calls).toHaveLength(1);
  });
  it('surfaces user errors from each write, and does not tag when the metafields fail', async () => {
    const badSet = { metafieldsSet: { metafields: [], userErrors: [{ message: 'Bad value' }] } };
    const failing = fakeClient(found(), badSet);
    await expect(linkKit(failing, link)).rejects.toThrow('Bad value');
    expect(failing.calls).toHaveLength(2);
    const badTag = { tagsAdd: { userErrors: [{ message: 'Tag problem' }] } };
    await expect(linkKit(fakeClient(found(), written, badTag), link)).rejects.toThrow('Tag problem');
  });
});
