import { fakeClient } from '../shopify/fakeClient';
import type { InventoryReport, ReportProduct } from '../shopify/trackedCatalog';
import { ensureSetupState } from './ensureSetup';

const L = 'gid://shopify/Location/1';
const monitored: ReportProduct = {
  id: 'p', title: 'Rum', truncated: false,
  variants: [{ id: 'v', productId: 'p', productTitle: 'Rum', title: 'Mini', sku: 's', inventoryItemId: 'i', digest: null, targets: { [L]: { min: 1, max: 2 } } }],
};
const report = (over: Partial<InventoryReport> = {}): InventoryReport => ({
  locations: [], sourceIds: [], packSizes: { defaultSize: 1, groups: [] }, products: [], levels: {}, pending: {}, ...over,
});
const saved = { currentAppInstallation: { id: 'gid://shopify/AppInstallation/1' } };
const setOk = { metafieldsSet: { metafields: [{ key: 'setup', compareDigest: null }], userErrors: [] } };
const writtenValue = (client: ReturnType<typeof fakeClient>) => JSON.parse(((client.calls[1]?.variables?.metafields as Array<{ value: string }>)[0] as { value: string }).value);

describe('ensureSetupState', () => {
  it('returns a saved state as it is, without writing', async () => {
    const client = fakeClient();
    const state = { completed: false, transfersSkipped: true, guideDismissed: false };
    await expect(ensureSetupState(client, report({ setup: state }))).resolves.toEqual(state);
    expect(client.calls).toHaveLength(0);
  });
  it('a new install is saved as not complete, so later targets cannot switch alerts on by themselves', async () => {
    const client = fakeClient(saved, setOk);
    await expect(ensureSetupState(client, report())).resolves.toEqual({ completed: false, transfersSkipped: false, guideDismissed: false });
    expect(writtenValue(client)).toEqual({ completed: false, transfersSkipped: false, guideDismissed: false });
  });
  it('an install that predates the guide is saved as complete with the guide closed', async () => {
    const client = fakeClient(saved, setOk);
    await expect(ensureSetupState(client, report({ products: [monitored] }))).resolves.toEqual({ completed: true, transfersSkipped: false, guideDismissed: true });
    expect(writtenValue(client)).toMatchObject({ completed: true, guideDismissed: true });
  });
  it('still answers, and logs, when the write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = fakeClient(new Error('boom'));
    await expect(ensureSetupState(client, report())).resolves.toMatchObject({ completed: false });
    vi.restoreAllMocks();
  });
});
