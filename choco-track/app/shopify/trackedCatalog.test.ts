import { ShopifyApiError } from './errors';
import { fakeClient } from './fakeClient';
import {
  TooManyDraftsError,
  findFlaggedProductIds,
  loadInventoryReport,
  loadLevels,
  loadPendingDrafts,
  loadProducts,
  loadSourceIds,
  type ReportVariant,
} from './trackedCatalog';
import { routedClient } from './routedClient';

const W = 'gid://shopify/Location/1';
const M = 'gid://shopify/Location/2';

const variantNode = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: 'Default Title',
  sku: `SKU-${id}`,
  image: null,
  inventoryItem: { id: `item-${id}` },
  targets: null,
  ...over,
});
const productNode = (id: string, title: string, variants: unknown[], hasNext = false, media: string | null = null) => ({
  id,
  title,
  featuredMedia: media ? { preview: { image: { url: media } } } : null,
  variants: { nodes: variants, pageInfo: { hasNextPage: hasNext } },
});

describe('findFlaggedProductIds', () => {
  it('searches by the product flag and returns the ids', async () => {
    const client = fakeClient({ products: { nodes: [{ id: 'p1' }, { id: 'p2' }], pageInfo: { hasNextPage: false, endCursor: null } } });
    await expect(findFlaggedProductIds(client)).resolves.toEqual(['p1', 'p2']);
    expect(client.calls[0]?.variables).toMatchObject({ query: 'metafields.choco_track.tracked:true' });
  });
  it('follows pages and stops at the safety cap', async () => {
    const page = (id: string, next: boolean) => ({ products: { nodes: [{ id }], pageInfo: { hasNextPage: next, endCursor: `c-${id}` } } });
    const client = fakeClient(page('p1', true), page('p2', true), page('p3', true));
    await expect(findFlaggedProductIds(client)).resolves.toEqual(['p1', 'p2']);
    expect(client.calls).toHaveLength(2);
    expect(client.calls[1]?.variables).toMatchObject({ after: 'c-p1' });
  });
});

describe('loadProducts', () => {
  it('maps products and variants, parses targets and keeps the digest', async () => {
    const targets = { value: JSON.stringify({ [W]: { min: 10, max: 40 } }), compareDigest: 'dg1' };
    const client = fakeClient({
      nodes: [
        productNode('p1', 'Rum Caramel', [variantNode('v1', { title: 'Mini', targets, image: { url: 'v.png' } }), variantNode('v2', { sku: null })], false, 'p.png'),
      ],
    });
    const [product] = await loadProducts(client, ['p1']);
    expect(product).toMatchObject({ id: 'p1', title: 'Rum Caramel', imageUrl: 'p.png', truncated: false });
    expect(product?.variants[0]).toEqual({
      id: 'v1',
      productId: 'p1',
      productTitle: 'Rum Caramel',
      title: 'Mini',
      sku: 'SKU-v1',
      imageUrl: 'v.png',
      inventoryItemId: 'item-v1',
      targets: { [W]: { min: 10, max: 40 } },
      digest: 'dg1',
    });
    expect(product?.variants[1]).toMatchObject({ sku: '', targets: {}, digest: null, imageUrl: 'p.png' });
  });
  it('sorts by title, skips missing nodes, and flags products with more variants than were read', async () => {
    const client = fakeClient({ nodes: [productNode('p2', 'Zorzal', [variantNode('a')], true), null, {}, productNode('p1', 'Bolivia', [])] });
    const products = await loadProducts(client, ['p2', 'gone', 'x', 'p1']);
    expect(products.map((p) => [p.title, p.truncated])).toEqual([['Bolivia', false], ['Zorzal', true]]);
  });
  it('reads in batches and does nothing for no ids', async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `p${i}`);
    const client = fakeClient({ nodes: [] }, { nodes: [] }, { nodes: [] });
    await loadProducts(client, ids);
    expect(client.calls).toHaveLength(3);
    expect(await loadProducts(fakeClient(), [])).toEqual([]);
  });
});

describe('loadLevels', () => {
  const level = (loc: string, available: number, incoming?: number) => ({
    location: { id: loc },
    quantities: [{ name: 'available', quantity: available }, ...(incoming === undefined ? [] : [{ name: 'incoming', quantity: incoming }])],
  });
  it('maps available and incoming per location, defaulting a missing name to 0', async () => {
    const client = fakeClient({
      nodes: [{ id: 'v1', inventoryItem: { inventoryLevels: { nodes: [level(W, 5, 2), level(M, 7)] } } }, null, {}],
    });
    await expect(loadLevels(client, ['v1', 'gone', 'x'])).resolves.toEqual({
      v1: { [W]: { available: 5, incoming: 2 }, [M]: { available: 7, incoming: 0 } },
    });
  });
  it('batches large requests', async () => {
    const client = fakeClient({ nodes: [] }, { nodes: [] });
    await loadLevels(client, Array.from({ length: 40 }, (_, i) => `v${i}`));
    expect(client.calls).toHaveLength(2);
  });
});

describe('loadPendingDrafts', () => {
  const variants = [{ id: 'v1', inventoryItemId: 'i1' }, { id: 'v2', inventoryItemId: 'i2' }] as ReportVariant[];
  const transfer = (dest: string | null, ...lines: Array<[string, number]>) => ({
    destination: dest ? { location: { id: dest } } : { location: null },
    lineItems: { nodes: lines.map(([item, totalQuantity]) => ({ inventoryItem: { id: item }, totalQuantity })) },
  });
  it('sums draft quantities by variant and destination, asking only for the app\'s drafts', async () => {
    const client = fakeClient({
      inventoryTransfers: { nodes: [transfer(M, ['i1', 5], ['i2', 2]), transfer(M, ['i1', 3]), transfer(W, ['i1', 1])] },
    });
    await expect(loadPendingDrafts(client, variants)).resolves.toEqual({ v1: { [M]: 8, [W]: 1 }, v2: { [M]: 2 } });
    expect(client.calls[0]?.variables).toMatchObject({ query: 'status:draft tag:choco-track' });
  });
  it('ignores lines for untracked items and transfers whose destination is gone', async () => {
    const client = fakeClient({ inventoryTransfers: { nodes: [transfer(M, ['other', 9]), transfer(null, ['i1', 4])] } });
    await expect(loadPendingDrafts(client, variants)).resolves.toEqual({});
  });
  it('refuses to guess when there are more open drafts than one read returns', async () => {
    const client = fakeClient({ inventoryTransfers: { nodes: [], pageInfo: { hasNextPage: true } } });
    await expect(loadPendingDrafts(client, variants)).rejects.toBeInstanceOf(TooManyDraftsError);
  });
  it('skips the call when nothing is tracked', async () => {
    const client = fakeClient();
    await expect(loadPendingDrafts(client, [])).resolves.toEqual({});
    expect(client.calls).toHaveLength(0);
  });
});

describe('loadSourceIds', () => {
  it('reads the ordered location ids saved with the app', async () => {
    const client = fakeClient({ currentAppInstallation: { metafield: { value: JSON.stringify([W, M]) } } });
    await expect(loadSourceIds(client)).resolves.toEqual([W, M]);
  });
  it.each([[null], [{ value: 'nope' }], [{ value: '{"a":1}' }], [{ value: '[1,"x"]' }]])('treats %j as none or drops bad entries', async (metafield) => {
    const ids = await loadSourceIds(fakeClient({ currentAppInstallation: { metafield } }));
    expect(ids.every((id) => typeof id === 'string')).toBe(true);
    if (metafield === null || (metafield && metafield.value !== '[1,"x"]')) expect(ids).toEqual([]);
    else expect(ids).toEqual(['x']);
  });
});

describe('loadInventoryReport', () => {
  const levelsNode = { id: 'v1', inventoryItem: { inventoryLevels: { nodes: [{ location: { id: W }, quantities: [{ name: 'available', quantity: 9 }, { name: 'incoming', quantity: 1 }] }] } } };
  const routes = (over: Record<string, unknown> = {}) => ({
    'query Locations': { locations: { nodes: [{ id: W, name: 'Warehouse', isActive: true }, { id: M, name: 'Market', isActive: false }] } },
    'query SourceLocations': { currentAppInstallation: { metafield: { value: JSON.stringify([W]) } } },
    'query FlaggedProducts': { products: { nodes: [{ id: 'p1' }], pageInfo: { hasNextPage: false, endCursor: null } } },
    'query TrackedProducts': { nodes: [productNode('p1', 'Rum', [variantNode('v1', { targets: { value: JSON.stringify({ [W]: { min: 5, max: 20 } }), compareDigest: 'd' } })])] },
    'query TrackedLevels': { nodes: [levelsNode] },
    'query DraftTransfers': { inventoryTransfers: { nodes: [] } },
    ...over,
  });

  it('loads locations, sources, products, levels and pending drafts together', async () => {
    const report = await loadInventoryReport(routedClient(routes()));
    expect(report.locations).toEqual([{ id: W, name: 'Warehouse' }]);
    expect(report.sourceIds).toEqual([W]);
    expect(report.products.map((p) => p.title)).toEqual(['Rum']);
    expect(report.levels).toEqual({ v1: { [W]: { available: 9, incoming: 1 } } });
    expect(report.pending).toEqual({});
    expect(report.draftsError).toBeUndefined();
  });
  it('still returns the report, with a notice, when draft transfers cannot be read', async () => {
    const denied = new ShopifyApiError('Access denied for inventoryTransfers field. Required access: `read_inventory_transfers` access scope.');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const report = await loadInventoryReport(routedClient(routes({ 'query DraftTransfers': denied })));
    expect(report.pending).toEqual({});
    expect(report.draftsError).toMatch(/permission/i);
    vi.restoreAllMocks();
  });
  it('says why suggestions are off when there are too many open drafts', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const many = { inventoryTransfers: { nodes: [], pageInfo: { hasNextPage: true } } };
    const report = await loadInventoryReport(routedClient(routes({ 'query DraftTransfers': many })));
    expect(report.draftsError).toMatch(/more than 50 open draft transfers/);
    vi.restoreAllMocks();
  });
  it('makes no product reads when nothing is flagged', async () => {
    const client = routedClient(routes({ 'query FlaggedProducts': { products: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } }));
    const report = await loadInventoryReport(client);
    expect(report.products).toEqual([]);
    expect(client.calls.some((c) => c.query.includes('TrackedProducts'))).toBe(false);
  });
});
