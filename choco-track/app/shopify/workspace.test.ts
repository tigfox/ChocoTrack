import { fakeClient } from './fakeClient';
import { loadWorkspace, searchWithStock } from './workspace';

const variantNode = (id: string, sku: string, kitSize: string | null) => ({
  id,
  title: 'Default Title',
  sku,
  barcode: null,
  image: null,
  inventoryItem: { id: `i-${id}` },
  product: { title: sku, featuredMedia: null, collections: { nodes: [] }, kitSize: kitSize ? { value: kitSize } : null },
});
const stockNode = (id: string, qty: number) => ({
  id,
  inventoryItem: { inventoryLevels: { nodes: [{ location: { id: 'L1' }, quantities: [{ quantity: qty }] }] } },
});

describe('loadWorkspace', () => {
  it('loads locations, collections, kits and kit stock', async () => {
    const kitProduct = { ...variantNode('k1', 'SMP-6', '6').product, variants: { nodes: [{ ...variantNode('k1', 'SMP-6', '6'), product: undefined }] } };
    // The client is called in order: locations, collections, kits, then stock.
    const client = fakeClient(
      { locations: { nodes: [{ id: 'L1', name: 'Warehouse', isActive: true }] } },
      { collections: { nodes: [{ id: 'c1', title: 'Mini' }] } },
      { products: { nodes: [kitProduct] } },
      { nodes: [stockNode('k1', 4)] },
    );
    const ws = await loadWorkspace(client);
    expect(ws.locations).toEqual([{ id: 'L1', name: 'Warehouse' }]);
    expect(ws.collections).toEqual([{ id: 'c1', title: 'Mini' }]);
    expect(ws.kits.map((k) => k.sku)).toEqual(['SMP-6']);
    expect(ws.stock).toEqual({ k1: { L1: 4 } });
  });
});

describe('searchWithStock', () => {
  it('returns results with their stock', async () => {
    const client = fakeClient({ productVariants: { nodes: [variantNode('v1', 'MINI-A', null)] } }, { nodes: [stockNode('v1', 9)] });
    const result = await searchWithStock(client, { text: 'a' });
    expect(result.variants.map((v) => v.sku)).toEqual(['MINI-A']);
    expect(result.stock).toEqual({ v1: { L1: 9 } });
  });
});
