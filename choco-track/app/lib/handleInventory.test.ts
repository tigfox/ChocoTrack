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
  'query SourceLocations': {
    currentAppInstallation: { metafield: { value: JSON.stringify([W]) }, packSizes: { value: JSON.stringify({ default: 1, groups: [] }) } },
  },
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

  describe('setVariantUntracked', () => {
    const V = 'gid://shopify/ProductVariant/1';
    it('switches a variant off and on', async () => {
      const c = routedClient({ 'mutation SetMetafields': setOk });
      await expect(handleInventory(c, { intent: 'setVariantUntracked', variantId: V, untracked: true })).resolves.toEqual({
        ok: true,
        message: 'Stopped tracking this variant.',
      });
      await expect(handleInventory(c, { intent: 'setVariantUntracked', variantId: V, untracked: false })).resolves.toEqual({
        ok: true,
        message: 'Tracking this variant again.',
      });
    });
    it('refuses a bad request without calling Shopify', async () => {
      const c = routedClient({});
      await expect(handleInventory(c, { intent: 'setVariantUntracked', variantId: 'x', untracked: true })).resolves.toEqual({ ok: false, message: 'Invalid request.' });
      expect(c.calls).toHaveLength(0);
    });
  });

  describe('savePackSizes', () => {
    const client = () => routedClient({ 'query AppInstallationId': { currentAppInstallation: { id: 'gid://shopify/AppInstallation/1' } }, 'mutation SetMetafields': setOk });
    const V = 'gid://shopify/ProductVariant/1';
    it('stores the pack sizes', async () => {
      const c = client();
      await expect(handleInventory(c, { intent: 'savePackSizes', defaultSize: 1, groups: [{ size: 100, variantIds: [V] }] })).resolves.toEqual({
        ok: true,
        message: 'Saved pack sizes.',
      });
      expect(c.calls.find((x) => x.query.includes('SetMetafields'))?.variables).toMatchObject({
        metafields: [{ value: `{"default":1,"groups":[{"size":100,"variantIds":["${V}"]}]}` }],
      });
    });
    it('refuses a bad request without calling Shopify', async () => {
      const c = client();
      await expect(handleInventory(c, { intent: 'savePackSizes', defaultSize: 0, groups: [] })).resolves.toEqual({ ok: false, message: 'Enter a whole number from 1 to 1000.' });
      expect(c.calls).toHaveLength(0);
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
    it('ships in the pack size of the saved group the variant is in', async () => {
      const wide = productNode({ [W]: { min: 0, max: 1000 }, [M]: { min: 10, max: 330 } });
      const routes = reportRoutes({
        'mutation CreateDraftTransfer': created,
        'query TrackedProducts': { nodes: [wide] },
        'query TrackedLevels': { nodes: [levelsNode(900, 4)] },
        'query SourceLocations': {
          currentAppInstallation: { metafield: { value: JSON.stringify([W]) }, packSizes: { value: JSON.stringify({ default: 1, groups: [{ size: 100, variantIds: [V] }] }) } },
        },
      });
      const client = routedClient(routes);
      const out = await handleInventory(client, { intent: 'createTransfers', key: KEY });
      expect(out).toMatchObject({ ok: true, created: [{ lines: [{ variantId: V, quantity: 300 }] }] }); // need 326, pack of 100
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

  describe('setup', () => {
    const state = (over: object = {}) => ({ completed: false, transfersSkipped: false, guideDismissed: false, ...over });
    const settings = (stored?: object) => ({
      currentAppInstallation: { metafield: { value: JSON.stringify([W]) }, packSizes: null, ...(stored ? { setup: { value: JSON.stringify(stored) } } : {}) },
    });
    const writes = { 'query AppInstallationId': { currentAppInstallation: { id: 'gid://shopify/AppInstallation/1' } }, 'mutation SetMetafields': setOk };
    const written = (client: { calls: ReadonlyArray<{ query: string; variables?: Record<string, unknown> }> }) =>
      JSON.parse(((client.calls.find((c) => c.query.includes('SetMetafields'))?.variables?.metafields as Array<{ value: string }>)[0] as { value: string }).value);

    it('turns alerts on after checking fresh data', async () => {
      const client = routedClient(reportRoutes({ ...writes, 'query SourceLocations': settings(state()) }));
      const out = await handleInventory(client, { intent: 'setup', action: 'complete' });
      expect(out).toMatchObject({ ok: true, setup: state({ completed: true }) });
      expect(written(client)).toEqual(state({ completed: true }));
    });
    it('refuses to turn alerts on when nothing has targets, and writes nothing', async () => {
      const noTargets = { 'query TrackedProducts': { nodes: [productNode()] } };
      const client = routedClient(reportRoutes({ ...writes, ...noTargets, 'query SourceLocations': settings(state()) }));
      const out = await handleInventory(client, { intent: 'setup', action: 'complete' });
      expect(out).toMatchObject({ ok: false, message: expect.stringMatching(/product/i) });
      expect(client.calls.some((c) => c.query.includes('SetMetafields'))).toBe(false);
    });
    it('restarts without reading the report', async () => {
      const client = routedClient(writes);
      const out = await handleInventory(client, { intent: 'setup', action: 'restart' });
      expect(out).toMatchObject({ ok: true, setup: state() });
      expect(written(client)).toEqual(state());
      expect(client.calls.some((c) => c.query.includes('FlaggedProducts'))).toBe(false);
    });
    it('skips the transfers step', async () => {
      const client = routedClient(reportRoutes({ ...writes, 'query SourceLocations': settings(state()) }));
      await expect(handleInventory(client, { intent: 'setup', action: 'skipTransfers' })).resolves.toMatchObject({ ok: true, setup: state({ transfersSkipped: true }) });
    });
    it('does not turn alerts off for an install that predates the guide when a step is skipped', async () => {
      const client = routedClient(reportRoutes({ ...writes, 'query SourceLocations': settings() }));
      const out = await handleInventory(client, { intent: 'setup', action: 'skipTransfers' });
      expect(out).toMatchObject({ ok: true, setup: { completed: true, transfersSkipped: true } });
    });
    it('skipping or closing reads only the saved state when there is one, not the whole report', async () => {
      const client = routedClient({ ...writes, 'query SourceLocations': settings(state({ completed: true })) });
      await expect(handleInventory(client, { intent: 'setup', action: 'skipTransfers' })).resolves.toMatchObject({ ok: true });
      expect(client.calls.some((c) => c.query.includes('FlaggedProducts'))).toBe(false);
    });
    it('closes the guide only when setup is complete', async () => {
      const done = routedClient(reportRoutes({ ...writes, 'query SourceLocations': settings(state({ completed: true })) }));
      await expect(handleInventory(done, { intent: 'setup', action: 'dismissGuide' })).resolves.toMatchObject({ ok: true, setup: state({ completed: true, guideDismissed: true }) });
      const early = routedClient(reportRoutes({ ...writes, 'query SourceLocations': settings(state()) }));
      await expect(handleInventory(early, { intent: 'setup', action: 'dismissGuide' })).resolves.toMatchObject({ ok: false });
      expect(early.calls.some((c) => c.query.includes('SetMetafields'))).toBe(false);
    });
    it('rejects an unknown action before calling Shopify', async () => {
      const client = routedClient({});
      await expect(handleInventory(client, { intent: 'setup', action: 'drop' })).resolves.toEqual({ ok: false, message: 'Invalid request.' });
      expect(client.calls).toHaveLength(0);
    });
  });

  describe('resetSettings', () => {
    const resetRoutes = {
      'query AllProductIds': { products: { nodes: [{ id: P }], pageInfo: { hasNextPage: false, endCursor: null } } },
      'query TrackedProducts': { nodes: [productNode({ [W]: { min: 1, max: 2 } })] },
      'mutation DeleteMetafields': { metafieldsDelete: { deletedMetafields: [], userErrors: [] } },
      'query AppInstallationId': { currentAppInstallation: { id: 'gid://shopify/AppInstallation/1' } },
      'mutation SetMetafields': setOk,
    };
    it('resets everything and reports what was cleared', async () => {
      const out = await handleInventory(routedClient(resetRoutes), { intent: 'resetSettings', confirm: true });
      expect(out).toMatchObject({ ok: true, setup: { completed: false, transfersSkipped: false, guideDismissed: false } });
      expect(out.message).toMatch(/1 product/);
      expect(out.message).toMatch(/1 variant/);
    });
    it('refuses without confirmation and changes nothing', async () => {
      const client = routedClient(resetRoutes);
      await expect(handleInventory(client, { intent: 'resetSettings' })).resolves.toEqual({ ok: false, message: 'Invalid request.' });
      expect(client.calls).toHaveLength(0);
    });
    it('explains a Shopify failure', async () => {
      const out = await handleInventory(routedClient({ ...resetRoutes, 'mutation DeleteMetafields': new ShopifyApiError('Throttled') }), { intent: 'resetSettings', confirm: true });
      expect(out.ok).toBe(false);
    });
  });
});
