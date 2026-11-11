import { fakeClient } from './fakeClient';
import { loadWorkspace } from './workspace';

const level = (loc: string, quantity: number) => ({ location: { id: loc }, quantities: [{ quantity }] });
const variantNode = (id: string, sku: string, kitSize: string | null, qty = 4) => ({
  id,
  title: 'Default Title',
  sku,
  barcode: null,
  image: null,
  inventoryItem: { id: `i-${id}`, inventoryLevels: { nodes: [level('L1', qty)] } },
  product: { title: sku, featuredMedia: null, collections: { nodes: [] }, kitSize: kitSize ? { value: kitSize } : null },
});

describe('loadWorkspace', () => {
  it('loads locations, collections, kits and kit stock in one round trip', async () => {
    const kit = variantNode('k1', 'SMP-6', '6');
    const { product, ...variant } = kit;
    const client = fakeClient(
      { locations: { nodes: [{ id: 'L1', name: 'Warehouse', isActive: true }] } },
      { collections: { nodes: [{ id: 'c1', title: 'Mini' }] } },
      { products: { nodes: [{ ...product, variants: { nodes: [variant] } }] } },
    );
    const ws = await loadWorkspace(client);
    expect(ws.locations).toEqual([{ id: 'L1', name: 'Warehouse' }]);
    expect(ws.collections).toEqual([{ id: 'c1', title: 'Mini' }]);
    expect(ws.kits.map((k) => k.sku)).toEqual(['SMP-6']);
    expect(ws.stock).toEqual({ k1: { L1: 4 } });
    expect(client.calls).toHaveLength(3);
  });
});
