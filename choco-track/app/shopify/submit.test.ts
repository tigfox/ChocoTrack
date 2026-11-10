import type { CatalogVariant } from './catalog';
import { fakeClient } from './fakeClient';
import { submitRun, type SubmitRequest } from './submit';

const mini = (id: string): CatalogVariant => ({ id, inventoryItemId: `item-${id}`, title: id, sku: id, barcode: '', collectionIds: [] });
const kit: CatalogVariant = { ...mini('kit'), kitSize: 6 };
const ok = { inventoryAdjustQuantities: { inventoryAdjustmentGroup: { id: 'g1' }, userErrors: [] } };

const base = (over: Partial<SubmitRequest> = {}): SubmitRequest => ({
  mode: 'assemble',
  kit,
  kitCount: 2,
  perKit: { a: 4, b: 2 },
  locationId: 'L1',
  variants: [mini('a'), mini('b'), kit],
  stock: { a: { L1: 20 }, b: { L1: 20 }, kit: { L1: 1 } },
  runId: 'run-1',
  ...over,
});

const adjustInput = (c: { variables?: Readonly<Record<string, unknown>> } | undefined) =>
  (c?.variables as { input: { changes: unknown[]; referenceDocumentUri: string } }).input;

describe('submitRun', () => {
  it('assembles: consumes components, adds kits, one call, run id as idempotency key', async () => {
    const client = fakeClient(ok);
    const result = await submitRun(client, base());
    expect(result).toMatchObject({ ok: true, adjustmentId: 'g1' });
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.variables?.key).toBe('run-1');
    expect(adjustInput(client.calls[0]).referenceDocumentUri).toBe('gid://choco-track/Assembly/run-1');
    expect(adjustInput(client.calls[0]).changes).toEqual([
      { inventoryItemId: 'item-a', locationId: 'L1', delta: -8, changeFromQuantity: 20 },
      { inventoryItemId: 'item-b', locationId: 'L1', delta: -4, changeFromQuantity: 20 },
      { inventoryItemId: 'item-kit', locationId: 'L1', delta: 2, changeFromQuantity: 1 },
    ]);
  });
  it('disassembles: removes kits, returns components x kit count', async () => {
    const client = fakeClient(ok);
    const stock = { a: { L1: 20 }, b: { L1: 20 }, kit: { L1: 5 } };
    const result = await submitRun(client, base({ mode: 'disassemble', stock }));
    expect(result.ok).toBe(true);
    expect(adjustInput(client.calls[0]).referenceDocumentUri).toBe('gid://choco-track/Disassembly/run-1');
    expect(adjustInput(client.calls[0]).changes).toEqual([
      { inventoryItemId: 'item-kit', locationId: 'L1', delta: -2, changeFromQuantity: 5 },
      { inventoryItemId: 'item-a', locationId: 'L1', delta: 8, changeFromQuantity: 20 },
      { inventoryItemId: 'item-b', locationId: 'L1', delta: 4, changeFromQuantity: 20 },
    ]);
  });
  it('activates a kit that is not yet stocked at the location', async () => {
    const client = fakeClient({ inventoryActivate: { userErrors: [] } }, ok);
    const result = await submitRun(client, base({ stock: { a: { L1: 20 }, b: { L1: 20 } } }));
    expect(result.ok).toBe(true);
    expect(client.calls).toHaveLength(2);
    expect(client.calls[0]?.variables).toEqual({ inventoryItemId: 'item-kit', locationId: 'L1' });
  });
  it('validates before calling Shopify', async () => {
    const client = fakeClient();
    const result = await submitRun(client, base({ perKit: { a: 1 } }));
    expect(result).toMatchObject({ ok: false, kind: 'validation' });
    expect(client.calls).toHaveLength(0);
  });
  it('returns a validation failure when no kit is chosen', async () => {
    const result = await submitRun(fakeClient(), base({ kit: undefined }));
    expect(result).toMatchObject({ ok: false, kind: 'validation' });
  });
  it('on stale stock, returns a conflict with refreshed quantities', async () => {
    const stale = { inventoryAdjustQuantities: { inventoryAdjustmentGroup: null, userErrors: [{ message: 's', code: 'CHANGE_FROM_QUANTITY_STALE' }] } };
    const fresh = { nodes: [{ id: 'a', inventoryItem: { inventoryLevels: { nodes: [{ location: { id: 'L1' }, quantities: [{ quantity: 3 }] }] } } }] };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await submitRun(fakeClient(stale, fresh), base());
    expect(result).toMatchObject({ ok: false, kind: 'conflict' });
    if (result.ok || result.kind !== 'conflict') throw new Error('expected conflict');
    expect(result.stock.a).toEqual({ L1: 3 });
    expect(result.stock.b).toEqual({ L1: 20 });
  });
  it('reports other failures without leaking details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await submitRun(fakeClient(new Error('secret token abc')), base());
    expect(result).toEqual({ ok: false, kind: 'error', message: 'Something went wrong. Please try again.' });
  });
  it('generates a run id when none is given', async () => {
    const client = fakeClient(ok);
    await submitRun(client, base({ runId: undefined }));
    expect(String(client.calls[0]?.variables?.key)).toMatch(/^[0-9a-f-]{36}$/);
  });
});
