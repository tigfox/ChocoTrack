import { fakeClient } from './fakeClient';
import { ShopifyUserErrors } from './errors';
import { activateInventory, adjustInventory, ensureStocked, guardStock, loadStock, NotStockedError } from './inventory';

const level = (location: string, quantity: number) => ({ location: { id: location }, quantities: [{ quantity }] });
const stockNode = (id: string, ...levels: ReturnType<typeof level>[]) => ({ id, inventoryItem: { inventoryLevels: { nodes: levels } } });

describe('loadStock', () => {
  it('maps variants to quantities per location and skips missing nodes', async () => {
    const client = fakeClient({ nodes: [stockNode('v1', level('L1', 5), level('L2', 0)), null, {}] });
    await expect(loadStock(client, ['v1', 'gone', 'x'])).resolves.toEqual({ v1: { L1: 5, L2: 0 } });
  });
  it('batches large requests', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `v${i}`);
    const client = fakeClient({ nodes: [] }, { nodes: [] }, { nodes: [] });
    await loadStock(client, ids);
    expect(client.calls.map((c) => (c.variables?.ids as string[]).length)).toEqual([100, 100, 50]);
  });
  it('treats a level without an available quantity as 0', async () => {
    const client = fakeClient({ nodes: [{ id: 'v1', inventoryItem: { inventoryLevels: { nodes: [{ location: { id: 'L1' }, quantities: [] }] } } }] });
    await expect(loadStock(client, ['v1'])).resolves.toEqual({ v1: { L1: 0 } });
  });
});

describe('activateInventory', () => {
  it('sends item and location', async () => {
    const client = fakeClient({ inventoryActivate: { userErrors: [] } });
    await activateInventory(client, 'i1', 'L1');
    expect(client.calls[0]?.variables).toEqual({ inventoryItemId: 'i1', locationId: 'L1' });
  });
  it('throws on user errors', async () => {
    const client = fakeClient({ inventoryActivate: { userErrors: [{ message: 'nope' }] } });
    await expect(activateInventory(client, 'i1', 'L1')).rejects.toThrow(ShopifyUserErrors);
  });
});

const request = {
  changes: [
    { variantId: 'v1', locationId: 'L1', delta: -6 },
    { variantId: 'kit', locationId: 'L1', delta: 1 },
  ],
  inventoryItemIds: { v1: 'i1', kit: 'ik' },
  stock: { v1: { L1: 20 }, kit: { L1: 3 } },
  reason: 'correction',
  referenceDocumentUri: 'gid://choco-track/Assembly/r1',
  idempotencyKey: 'key-1',
};

describe('adjustInventory', () => {
  it('sends every line in one call, guarded by the stock the user saw', async () => {
    const client = fakeClient({ inventoryAdjustQuantities: { inventoryAdjustmentGroup: { id: 'g1' }, userErrors: [] } });
    await expect(adjustInventory(client, request)).resolves.toBe('g1');
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.variables).toEqual({
      key: 'key-1',
      input: {
        name: 'available',
        reason: 'correction',
        referenceDocumentUri: 'gid://choco-track/Assembly/r1',
        changes: [
          { inventoryItemId: 'i1', locationId: 'L1', delta: -6, changeFromQuantity: 20 },
          { inventoryItemId: 'ik', locationId: 'L1', delta: 1, changeFromQuantity: 3 },
        ],
      },
    });
    expect(client.calls[0]?.query).toContain('@idempotent(key: $key)');
  });
  it('refuses a line with no known stock level (it must be activated first)', async () => {
    const client = fakeClient();
    await expect(adjustInventory(client, { ...request, stock: { v1: { L1: 20 } } })).rejects.toThrow(NotStockedError);
    expect(client.calls).toHaveLength(0);
  });
  it('refuses a variant without an inventory item id', async () => {
    await expect(adjustInventory(fakeClient(), { ...request, inventoryItemIds: { v1: 'i1' } })).rejects.toThrow(NotStockedError);
  });
  it('surfaces the stale-stock rejection', async () => {
    const client = fakeClient({
      inventoryAdjustQuantities: { inventoryAdjustmentGroup: null, userErrors: [{ message: 'stale', code: 'CHANGE_FROM_QUANTITY_STALE' }] },
    });
    await expect(adjustInventory(client, request)).rejects.toMatchObject({ isStale: true });
  });
  it('fails if Shopify returns neither a group nor errors', async () => {
    const client = fakeClient({ inventoryAdjustQuantities: { inventoryAdjustmentGroup: null, userErrors: [] } });
    await expect(adjustInventory(client, request)).rejects.toThrow('adjustment record');
  });
});

describe('ensureStocked', () => {
  it('activates only missing levels and returns stock with them at 0', async () => {
    const client = fakeClient({ inventoryActivate: { userErrors: [] } });
    const stock = await ensureStocked(client, request.changes, request.inventoryItemIds, { v1: { L1: 20 } });
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.variables).toEqual({ inventoryItemId: 'ik', locationId: 'L1' });
    expect(stock).toEqual({ v1: { L1: 20 }, kit: { L1: 0 } });
  });
  it('does nothing when everything is stocked', async () => {
    const client = fakeClient();
    await ensureStocked(client, request.changes, request.inventoryItemIds, request.stock);
    expect(client.calls).toHaveLength(0);
  });
  it('rejects a missing inventory item id', async () => {
    await expect(ensureStocked(fakeClient(), request.changes, {}, {})).rejects.toThrow(NotStockedError);
  });
});

describe('guardStock', () => {
  const changes = [
    { variantId: 'v1', locationId: 'L1', delta: -1 },
    { variantId: 'kit', locationId: 'L1', delta: 1 },
    { variantId: 'v2', locationId: 'L1', delta: -1 },
  ];
  it('prefers what the user saw, falls back to live, and omits unknown levels', () => {
    const seen = { v1: { L1: 20 } };
    const live = { v1: { L1: 99 }, kit: { L1: 0 } };
    expect(guardStock(seen, live, changes)).toEqual({ v1: { L1: 20 }, kit: { L1: 0 } });
  });
});
