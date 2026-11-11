import { fakeClient } from '../shopify/fakeClient';
import { handleKitSettings } from './handleKitSettings';

const kitNode = { node: { product: { id: 'gid://shopify/Product/1', tags: ['choco-track-kit'] } } };
const updated = { productUpdate: { product: { id: 'gid://shopify/Product/1' }, userErrors: [] } };
const edit = { intent: 'update', kitId: 'gid://shopify/ProductVariant/1', title: 'Milk 5', size: 5, categoryId: 'gid://shopify/Collection/3' };
const created = {
  productSet: {
    product: {
      title: 'New', featuredMedia: null, collections: { nodes: [] }, kitSize: { value: '4' },
      variants: { nodes: [{ id: 'v', title: 'Default Title', sku: 'N-4', barcode: null, image: null, inventoryItem: { id: 'i' } }] },
    },
    userErrors: [],
  },
};

describe('handleKitSettings', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('saves an edit', async () => {
    const client = fakeClient(kitNode, updated);
    await expect(handleKitSettings(client, edit)).resolves.toEqual({ ok: true, message: 'Saved Milk 5.' });
  });
  it('creates a kit', async () => {
    const client = fakeClient({ productVariants: { nodes: [] } }, created);
    const out = await handleKitSettings(client, { intent: 'create', title: 'New', size: 4, sku: 'N-4' });
    expect(out).toEqual({ ok: true, message: 'Created New.' });
  });
  it.each([
    ['no body', undefined],
    ['unknown intent', { intent: 'delete' }],
    ['not an object', 'x'],
  ])('rejects %s without calling Shopify', async (_n, raw) => {
    const client = fakeClient();
    await expect(handleKitSettings(client, raw)).resolves.toEqual({ ok: false, message: 'Invalid request.' });
    expect(client.calls).toHaveLength(0);
  });
  it('returns validation messages without calling Shopify', async () => {
    const client = fakeClient();
    await expect(handleKitSettings(client, { ...edit, title: ' ' })).resolves.toEqual({ ok: false, message: 'Enter a title.' });
    await expect(handleKitSettings(client, { intent: 'create', title: 'T', size: 4 })).resolves.toEqual({ ok: false, message: 'Enter a SKU.' });
    expect(client.calls).toHaveLength(0);
  });
  it('turns Shopify failures into a friendly message and logs them', async () => {
    const client = fakeClient({ node: null });
    const out = await handleKitSettings(client, edit);
    expect(out).toEqual({ ok: false, message: 'That item is not a kit.' });
    expect(console.error).toHaveBeenCalled();
  });
});
