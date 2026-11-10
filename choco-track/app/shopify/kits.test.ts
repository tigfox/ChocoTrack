import { fakeClient } from './fakeClient';
import { createKit } from './kits';

const product = {
  title: 'Sampler Kit - 5 Pack',
  featuredMedia: null,
  collections: { nodes: [] },
  kitSize: { value: '5' },
  variants: { nodes: [{ id: 'v1', title: 'Default Title', sku: 'SMP-5', barcode: null, image: null, inventoryItem: { id: 'i1' } }] },
};

describe('createKit', () => {
  it('creates a tracked, tagged product with the size metafield', async () => {
    const client = fakeClient({ productSet: { product, userErrors: [] } });
    const kit = await createKit(client, { title: 'Sampler Kit - 5 Pack', size: 5, sku: 'SMP-5', price: '17.00' });
    expect(kit).toMatchObject({ id: 'v1', inventoryItemId: 'i1', sku: 'SMP-5', kitSize: 5, title: 'Sampler Kit - 5 Pack' });
    const input = (client.calls[0]?.variables as { input: Record<string, any> }).input;
    expect(input.tags).toEqual(['choco-track-kit']);
    expect(input.metafields).toEqual([{ namespace: 'choco_track', key: 'kit_size', type: 'number_integer', value: '5' }]);
    expect(input.variants[0]).toMatchObject({ sku: 'SMP-5', price: '17.00', inventoryItem: { tracked: true } });
  });
  it('defaults the price and omits an empty barcode', async () => {
    const client = fakeClient({ productSet: { product, userErrors: [] } });
    await createKit(client, { title: 'K', size: 5, sku: 'S' });
    const variant = (client.calls[0]?.variables as { input: { variants: Record<string, unknown>[] } }).input.variants[0];
    expect(variant?.price).toBe('0.00');
    expect(variant).not.toHaveProperty('barcode');
  });
  it('throws on user errors, such as a duplicate SKU', async () => {
    const client = fakeClient({ productSet: { product: null, userErrors: [{ message: 'SKU taken' }] } });
    await expect(createKit(client, { title: 'K', size: 4, sku: 'S' })).rejects.toThrow('SKU taken');
  });
  it('throws when no product comes back', async () => {
    const client = fakeClient({ productSet: { product: null, userErrors: [] } });
    await expect(createKit(client, { title: 'K', size: 4, sku: 'S' })).rejects.toThrow('did not return');
  });
});
