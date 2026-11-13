import { ShopifyApiError } from '../shopify/errors';
import { routedClient } from '../shopify/routedClient';
import { handleInventory } from './handleInventory';

const W = 'gid://shopify/Location/1';
const M = 'gid://shopify/Location/2';
const P = 'gid://shopify/Product/1';
const V = 'gid://shopify/ProductVariant/2';
const KEY = 'click-key-1234';

const productNode = (targets: Record<string, { min: number; max: number }> = {}) => ({
  id: P,
  title: 'Rum Caramel',
  featuredMedia: null,
  variants: {
    nodes: [
      {
        id: V,
        title: 'Mini',
        sku: 'RUM-M',
        image: null,
        inventoryItem: { id: 'item-1' },
        targets: Object.keys(targets).length ? { value: JSON.stringify(targets), compareDigest: 'dg' } : null,
      },
    ],
    pageInfo: { hasNextPage: false },
  },
});
const levelsNode = (w: number, m: number) => ({
  id: V,
  inventoryItem: {
    inventoryLevels: {
      nodes: [
        { location: { id: W }, quantities: [{ name: 'available', quantity: w }, { name: 'incoming', quantity: 0 }] },
        { location: { id: M }, quantities: [{ name: 'available', quantity: m }, { name: 'incoming', quantity: 0 }] },
      ],
    },
  },
});
const setOk = { metafieldsSet: { metafields: [{ key: 'k', compareDigest: 'new' }], userErrors: [] } };

const reportRoutes = (over: Record<string, unknown> = {}) => ({
  'query Locations': { locations: { nodes: [{ id: W, name: 'Warehouse', isActive: true }, { id: M, name: 'Market', isActive: true }] } },
  'query SourceLocations': { currentAppInstallation: { metafield: { value: JSON.stringify([W]) } } },
  'query FlaggedProducts': { products: { nodes: [{ id: P }], pageInfo: { hasNextPage: false, endCursor: null } } },
  'query TrackedProducts': { nodes: [productNode({ [W]: { min: 0, max: 100 }, [M]: { min: 10, max: 30 } })] },
  'query TrackedLevels': { nodes: [levelsNode(80, 4)] },
  'query DraftTransfers': { inventoryTransfers: { nodes: [] } },
  ...over,
});
const created = { inventoryTransferCreate: { inventoryTransfer: { id: 'T1' }, userErrors: [] } };

describe('handleInventory', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('rejects unknown or missing intents without calling Shopify', async () => {
    const client = routedClient({});
    for (const raw of [undefined, 'x', { intent: 'drop' }, {}]) {
      await expect(handleInventory(client, raw)).resolves.toEqual({ ok: false, message: 'Invalid request.' });
    }
    expect(client.calls).toHaveLength(0);
  });

  describe('setFlag', () => {
    const routes = {
      'mutation CreateTrackedDefinition': { metafieldDefinitionCreate: { userErrors: [] } },
      'mutation SetMetafields': setOk,
      'query TrackedProducts': { nodes: [productNode()] },
      'query TrackedLevels': { nodes: [levelsNode(5, 6)] },
    };
    it('flags a product and returns it with its counts', async () => {
      const out = await handleInventory(routedClient(routes), { intent: 'setFlag', productId: P, tracked: true });
      expect(out).toMatchObject({ ok: true, message: 'Now tracking Rum Caramel.', product: { id: P, title: 'Rum Caramel' } });
      expect(out.ok && out.levels).toEqual({ [V]: { [W]: { available: 5, incoming: 0 }, [M]: { available: 6, incoming: 0 } } });
    });
    it('unflags a product', async () => {
      const out = await handleInventory(routedClient(routes), { intent: 'setFlag', productId: P, tracked: false });
      expect(out).toMatchObject({ ok: true, message: 'Stopped tracking Rum Caramel.' });
    });
    it('validates before calling Shopify', async () => {
      const client = routedClient(routes);
      await expect(handleInventory(client, { intent: 'setFlag', productId: 'x', tracked: true })).resolves.toMatchObject({ ok: false });
      expect(client.calls).toHaveLength(0);
    });
  });

  describe('saveTargets', () => {
    const body = { intent: 'saveTargets', variantId: V, digest: 'dg', targets: { [W]: { min: 1, max: 5 } } };
    it('saves and returns the new digest', async () => {
      const client = routedClient({ 'mutation SetMetafields': setOk });
      await expect(handleInventory(client, body)).resolves.toEqual({ ok: true, message: 'Saved targets.', digest: 'new' });
    });
    it('explains an edit conflict', async () => {
      const stale = { metafieldsSet: { metafields: [], userErrors: [{ message: 'changed', code: 'STALE_OBJECT' }] } };
      const out = await handleInventory(routedClient({ 'mutation SetMetafields': stale }), body);
      expect(out).toMatchObject({ ok: false, message: expect.stringContaining('Someone else changed') });
    });
    it('returns validation errors without calling Shopify', async () => {
      const client = routedClient({});
      const out = await handleInventory(client, { ...body, targets: { [W]: { min: 9, max: 1 } } });
      expect(out).toEqual({ ok: false, message: 'Maximum must be at least the minimum.' });
      expect(client.calls).toHaveLength(0);
    });
  });

  describe('saveSources', () => {
    it('stores the ordered locations', async () => {
      const client = routedClient({ 'query AppInstallationId': { currentAppInstallation: { id: 'gid://shopify/AppInstallation/1' } }, 'mutation SetMetafields': setOk });
      await expect(handleInventory(client, { intent: 'saveSources', sourceIds: [W, M] })).resolves.toEqual({ ok: true, message: 'Saved source locations.' });
    });
  });

  describe('createTransfers', () => {
    it('recomputes from fresh data and creates one draft per route, tagged and keyed', async () => {
      const client = routedClient(reportRoutes({ 'mutation CreateDraftTransfer': created }));
      const out = await handleInventory(client, { intent: 'createTransfers', key: KEY });
      expect(out).toMatchObject({
        ok: true,
        message: 'Created 1 draft transfer in Shopify. Review it and mark it ready there.',
        created: [{ id: 'T1', originId: W, destinationId: M, lines: [{ variantId: V, quantity: 26 }] }],
      });
      const call = client.calls.find((c) => c.query.includes('CreateDraftTransfer'));
      expect(call?.variables).toMatchObject({ key: `${KEY}:${W}:${M}`, input: { lineItems: [{ inventoryItemId: 'item-1', quantity: 26 }] } });
    });
    it('can be limited to one route', async () => {
      const client = routedClient(reportRoutes({ 'mutation CreateDraftTransfer': created }));
      const none = await handleInventory(client, { intent: 'createTransfers', key: KEY, originId: M, destinationId: W });
      expect(none).toEqual({ ok: true, message: 'Nothing to transfer right now.', created: [] });
      expect(client.calls.some((c) => c.query.includes('CreateDraftTransfer'))).toBe(false);
    });
    it('does nothing when stock is already at target', async () => {
      const client = routedClient(reportRoutes({ 'query TrackedLevels': { nodes: [levelsNode(80, 25)] } }));
      await expect(handleInventory(client, { intent: 'createTransfers', key: KEY })).resolves.toEqual({
        ok: true,
        message: 'Nothing to transfer right now.',
        created: [],
      });
    });
    it('refuses when draft transfers cannot be read, so it cannot create duplicates', async () => {
      const denied = new ShopifyApiError('Access denied for inventoryTransfers field. Required access: read_inventory_transfers access scope.');
      const client = routedClient(reportRoutes({ 'query DraftTransfers': denied }));
      const out = await handleInventory(client, { intent: 'createTransfers', key: KEY });
      expect(out).toMatchObject({ ok: false, message: expect.stringContaining('permission') });
      expect(client.calls.some((c) => c.query.includes('CreateDraftTransfer'))).toBe(false);
    });
    it('says how far it got when a later draft fails', async () => {
      const C = 'gid://shopify/Location/3';
      let calls = 0;
      const flaky = (): unknown => {
        calls += 1;
        return calls === 1 ? created : new ShopifyApiError('boom');
      };
      const routes = reportRoutes({
        'query Locations': { locations: { nodes: [W, M, C].map((id) => ({ id, name: id, isActive: true })) } },
        'query TrackedProducts': { nodes: [productNode({ [W]: { min: 0, max: 100 }, [M]: { min: 10, max: 30 }, [C]: { min: 10, max: 30 } })] },
        'mutation CreateDraftTransfer': flaky,
      });
      // The warehouse can cover both the market (26) and the third location (30), which needs two drafts.
      const out = await handleInventory(routedClient(routes), { intent: 'createTransfers', key: KEY });
      expect(out).toMatchObject({ ok: false, message: expect.stringContaining('Created 1 of 2') });
    });
  });

  it('turns unexpected failures into a friendly message and logs them', async () => {
    const out = await handleInventory(routedClient({ 'mutation SetMetafields': new ShopifyApiError('down') }), {
      intent: 'saveTargets',
      variantId: V,
      digest: null,
      targets: { [W]: { min: 1, max: 2 } },
    });
    expect(out).toEqual({ ok: false, message: 'Shopify could not be reached or rejected the request. Please try again.' });
    expect(console.error).toHaveBeenCalled();
  });
});
