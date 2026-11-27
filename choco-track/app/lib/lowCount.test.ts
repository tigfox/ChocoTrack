import { computeLowCount, computeLowStatus, forgetLowCount, LOW_COUNT_TTL_MS, lookupLowStatus, readLowStatus } from './lowCount';
import { routedClient } from '../shopify/routedClient';
import type { ReportProduct } from '../shopify/trackedCatalog';

describe('readLowStatus', () => {
  afterEach(() => forgetLowCount('a.myshopify.com'));

  it('computes once and reuses the answer until it expires', async () => {
    const compute = vi.fn().mockResolvedValue(3);
    expect(await readLowStatus('a.myshopify.com', compute, 1_000)).toBe(3);
    expect(await readLowStatus('a.myshopify.com', compute, 1_000 + LOW_COUNT_TTL_MS - 1)).toBe(3);
    expect(compute).toHaveBeenCalledTimes(1);
    compute.mockResolvedValue(5);
    expect(await readLowStatus('a.myshopify.com', compute, 1_000 + LOW_COUNT_TTL_MS)).toBe(5);
    expect(compute).toHaveBeenCalledTimes(2);
  });
  it('keeps shops apart and forgets on request', async () => {
    const a = vi.fn().mockResolvedValue(1);
    const b = vi.fn().mockResolvedValue(2);
    expect(await readLowStatus('a.myshopify.com', a, 0)).toBe(1);
    expect(await readLowStatus('b.myshopify.com', b, 0)).toBe(2);
    forgetLowCount('a.myshopify.com');
    await readLowStatus('a.myshopify.com', a, 1);
    expect(a).toHaveBeenCalledTimes(2);
    forgetLowCount('b.myshopify.com');
  });
  it('does not cache a failure', async () => {
    const compute = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(4);
    await expect(readLowStatus('a.myshopify.com', compute, 0)).rejects.toThrow('x');
    expect(await readLowStatus('a.myshopify.com', compute, 1)).toBe(4);
  });
});

describe('computeLowCount', () => {
  const product: ReportProduct = {
    id: 'p',
    title: 'Rum',
    truncated: false,
    variants: [
      { id: 'a', productId: 'p', productTitle: 'Rum', title: 'Mini', sku: 'a', inventoryItemId: 'ia', digest: null, targets: { L: { min: 10, max: 20 } } },
      { id: 'b', productId: 'p', productTitle: 'Rum', title: 'Full', sku: 'b', inventoryItemId: 'ib', digest: null, targets: {} },
    ],
  };
  it('counts tracked variants that are low somewhere', () => {
    const report = { products: [product], levels: { a: { L: { available: 2, incoming: 0 } }, b: { L: { available: 0, incoming: 0 } } }, pending: {} };
    expect(computeLowCount(report)).toBe(1);
    expect(computeLowCount({ ...report, levels: { a: { L: { available: 12, incoming: 0 } } } })).toBe(0);
  });
});

describe('computeLowCount and untracked variants', () => {
  it('does not count an untracked variant that is low', () => {
    const product: ReportProduct = {
      id: 'p',
      title: 'Rum',
      truncated: false,
      variants: [{ id: 'a', productId: 'p', productTitle: 'Rum', title: 'Mini', sku: 'a', inventoryItemId: 'ia', digest: null, targets: { L: { min: 10, max: 20 } }, untracked: true }],
    };
    expect(computeLowCount({ products: [product], levels: { a: { L: { available: 0, incoming: 0 } } }, pending: {} })).toBe(0);
  });
});

describe('computeLowStatus', () => {
  const variant = (over: object = {}) => ({ id: 'a', productId: 'p', productTitle: 'Rum', title: 'Mini', sku: 'a', inventoryItemId: 'ia', digest: null, targets: { L: { min: 10, max: 20 } }, ...over });
  const report = (setup?: { completed: boolean; transfersSkipped: boolean; guideDismissed: boolean }, available = 2) => ({
    sourceIds: [],
    products: [{ id: 'p', title: 'Rum', truncated: false, variants: [variant()] }] as ReportProduct[],
    levels: { a: { L: { available, incoming: 0 } } },
    pending: {},
    ...(setup ? { setup } : {}),
  });
  const on = { completed: true, transfersSkipped: false, guideDismissed: false };
  const off = { completed: false, transfersSkipped: false, guideDismissed: false };

  it('counts low variants once setup is complete', () => {
    expect(computeLowStatus(report(on))).toEqual({ count: 1, setupNeeded: false });
  });
  it('reports no alerts, and that setup is needed, while setup is incomplete', () => {
    expect(computeLowStatus(report(off))).toEqual({ count: 0, setupNeeded: true });
  });
  it('treats an install that predates the guide, with targets, as set up', () => {
    expect(computeLowStatus(report())).toEqual({ count: 1, setupNeeded: false });
  });
  it('needs setup when never saved and nothing is monitored', () => {
    expect(computeLowStatus({ ...report(), products: [] })).toEqual({ count: 0, setupNeeded: true });
  });
});

describe('lookupLowStatus', () => {
  const W = 'gid://shopify/Location/1';
  const settings = (setup?: object) => ({
    currentAppInstallation: { metafield: null, packSizes: null, ...(setup ? { setup: { value: JSON.stringify(setup) } } : {}) },
  });
  const routes = (setup?: object) => ({
    'query SourceLocations': settings(setup),
    'query Locations': { locations: { nodes: [{ id: W, name: 'Warehouse', isActive: true }] } },
    'query FlaggedProducts': { products: { nodes: [{ id: 'p1' }], pageInfo: { hasNextPage: false, endCursor: null } } },
    'query TrackedProducts': {
      nodes: [{ id: 'p1', title: 'Rum', featuredMedia: null, variants: { nodes: [{ id: 'v1', title: 'Mini', sku: 's', image: null, inventoryItem: { id: 'i1' }, targets: { value: JSON.stringify({ [W]: { min: 5, max: 9 } }), compareDigest: 'd' } }], pageInfo: { hasNextPage: false } } }],
    },
    'query TrackedLevels': { nodes: [{ id: 'v1', inventoryItem: { inventoryLevels: { nodes: [{ location: { id: W }, quantities: [{ name: 'available', quantity: 1 }, { name: 'incoming', quantity: 0 }] }] } } }] },
    'query DraftTransfers': { inventoryTransfers: { nodes: [] } },
  });

  it('skips the report read entirely when setup was restarted or unfinished', async () => {
    const client = routedClient(routes({ completed: false }));
    await expect(lookupLowStatus(client)).resolves.toEqual({ count: 0, setupNeeded: true });
    expect(client.calls.some((c) => c.query.includes('FlaggedProducts'))).toBe(false);
  });
  it('counts low variants when setup is complete', async () => {
    await expect(lookupLowStatus(routedClient(routes({ completed: true })))).resolves.toEqual({ count: 1, setupNeeded: false });
  });
  it('treats a store that never saved a setup state, but has targets, as set up', async () => {
    await expect(lookupLowStatus(routedClient(routes()))).resolves.toEqual({ count: 1, setupNeeded: false });
  });
});
