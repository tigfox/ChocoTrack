import { fakeClient } from './fakeClient';
import {
  buildProductQuery,
  createDraftTransfer,
  saveSourceIds,
  saveVariantTargets,
  searchProductsForFlag,
  setProductFlag,
} from './inventoryWrites';

const W = 'gid://shopify/Location/1';
const M = 'gid://shopify/Location/2';
const defined = { metafieldDefinitionCreate: { createdDefinition: { id: 'd' }, userErrors: [] } };
const taken = { metafieldDefinitionCreate: { createdDefinition: null, userErrors: [{ message: 'in use', code: 'TAKEN' }] } };
const setOk = (digest: string | null = 'dg') => ({ metafieldsSet: { metafields: [{ key: 'k', compareDigest: digest }], userErrors: [] } });

describe('setProductFlag', () => {
  it('creates a searchable definition, then sets the flag', async () => {
    const client = fakeClient(defined, setOk());
    await setProductFlag(client, 'gid://shopify/Product/1', true);
    expect(client.calls[0]?.variables).toMatchObject({
      definition: { namespace: 'choco_track', key: 'tracked', ownerType: 'PRODUCT', type: 'boolean', capabilities: { adminFilterable: { enabled: true } } },
    });
    expect(client.calls[1]?.variables).toEqual({
      metafields: [{ ownerId: 'gid://shopify/Product/1', namespace: 'choco_track', key: 'tracked', type: 'boolean', value: 'true' }],
    });
  });
  it('carries on when the definition already exists', async () => {
    const client = fakeClient(taken, setOk());
    await expect(setProductFlag(client, 'p', true)).resolves.toBeUndefined();
    expect(client.calls).toHaveLength(2);
  });
  it('fails on any other definition error', async () => {
    const bad = { metafieldDefinitionCreate: { createdDefinition: null, userErrors: [{ message: 'nope', code: 'INVALID' }] } };
    await expect(setProductFlag(fakeClient(bad), 'p', true)).rejects.toThrow('nope');
  });
  it('unflagging only writes false', async () => {
    const client = fakeClient(setOk());
    await setProductFlag(client, 'p', false);
    expect(client.calls).toHaveLength(1);
    expect((client.calls[0]?.variables as { metafields: Array<{ value: string }> }).metafields[0]?.value).toBe('false');
  });
  it('surfaces write errors', async () => {
    const bad = { metafieldsSet: { metafields: [], userErrors: [{ message: 'blocked' }] } };
    await expect(setProductFlag(fakeClient(bad), 'p', false)).rejects.toThrow('blocked');
  });
});

describe('saveVariantTargets', () => {
  const base = { variantId: 'gid://shopify/ProductVariant/1', targets: { [W]: { min: 1, max: 5 }, [M]: { min: 2, max: 9 } }, digest: 'old' };
  it('writes the targets as JSON guarded by the digest and returns the new digest', async () => {
    const client = fakeClient(setOk('new'));
    await expect(saveVariantTargets(client, base)).resolves.toEqual({ digest: 'new' });
    const m = (client.calls[0]?.variables as { metafields: Array<Record<string, unknown>> }).metafields[0];
    expect(m).toMatchObject({ ownerId: base.variantId, namespace: 'choco_track', key: 'targets', type: 'json', compareDigest: 'old' });
    expect(JSON.parse(m?.value as string)).toEqual(base.targets);
  });
  it('passes a null digest for a variant that had no targets yet', async () => {
    const client = fakeClient(setOk('first'));
    await saveVariantTargets(client, { ...base, digest: null });
    expect((client.calls[0]?.variables as { metafields: Array<Record<string, unknown>> }).metafields[0]).toHaveProperty('compareDigest', null);
  });
  it('removes the metafield when no targets remain', async () => {
    const client = fakeClient({ metafieldsDelete: { deletedMetafields: [{ key: 'targets' }], userErrors: [] } });
    await expect(saveVariantTargets(client, { ...base, targets: {} })).resolves.toEqual({ digest: null });
    expect(client.calls[0]?.variables).toEqual({ metafields: [{ ownerId: base.variantId, namespace: 'choco_track', key: 'targets' }] });
  });
  it('reports an edit conflict', async () => {
    const stale = { metafieldsSet: { metafields: [], userErrors: [{ message: 'changed', code: 'STALE_OBJECT' }] } };
    await expect(saveVariantTargets(fakeClient(stale), base)).rejects.toMatchObject({ isStaleObject: true });
  });
  it('fails when Shopify returns no metafield', async () => {
    await expect(saveVariantTargets(fakeClient({ metafieldsSet: { metafields: [], userErrors: [] } }), base)).rejects.toThrow('did not return');
  });
  it('surfaces delete errors', async () => {
    const bad = { metafieldsDelete: { deletedMetafields: [], userErrors: [{ message: 'cannot' }] } };
    await expect(saveVariantTargets(fakeClient(bad), { ...base, targets: {} })).rejects.toThrow('cannot');
  });
});

describe('createDraftTransfer', () => {
  const req = { originId: W, destinationId: M, lines: [{ inventoryItemId: 'i1', quantity: 5 }], key: 'key-1' };
  it('creates a tagged draft with an idempotency key', async () => {
    const client = fakeClient({ inventoryTransferCreate: { inventoryTransfer: { id: 'T1', status: 'DRAFT' }, userErrors: [] } });
    await expect(createDraftTransfer(client, req)).resolves.toEqual({ id: 'T1' });
    expect(client.calls[0]?.query).toContain('@idempotent(key: $key)');
    expect(client.calls[0]?.variables).toMatchObject({
      key: 'key-1',
      input: { originLocationId: W, destinationLocationId: M, lineItems: [{ inventoryItemId: 'i1', quantity: 5 }], tags: ['choco-track'] },
    });
  });
  it('fails on user errors and when no transfer comes back', async () => {
    const bad = { inventoryTransferCreate: { inventoryTransfer: null, userErrors: [{ message: 'no stock' }] } };
    await expect(createDraftTransfer(fakeClient(bad), req)).rejects.toThrow('no stock');
    const none = { inventoryTransferCreate: { inventoryTransfer: null, userErrors: [] } };
    await expect(createDraftTransfer(fakeClient(none), req)).rejects.toThrow('did not return');
  });
});

describe('saveSourceIds', () => {
  it('stores the ordered ids on the app installation', async () => {
    const client = fakeClient({ currentAppInstallation: { id: 'gid://shopify/AppInstallation/1' } }, setOk());
    await saveSourceIds(client, [W, M]);
    expect(client.calls[1]?.variables).toEqual({
      metafields: [{ ownerId: 'gid://shopify/AppInstallation/1', namespace: '$app:inventory', key: 'sources', type: 'json', value: JSON.stringify([W, M]) }],
    });
  });
});

describe('buildProductQuery', () => {
  it.each([
    ['', undefined, null],
    ['  ', '', null],
    ['rum caramel', undefined, 'rum caramel'],
    ['', 'gid://shopify/Collection/42', 'collection_id:42'],
    ['rum', 'gid://shopify/Collection/42', 'collection_id:42 AND rum'],
    ['a OR b -c', undefined, 'a b c'],
  ])('builds %j + %j', (text, collection, expected) => {
    expect(buildProductQuery(text, collection)).toBe(expected);
  });
});

describe('searchProductsForFlag', () => {
  it('lists products with their flag state', async () => {
    const client = fakeClient({
      products: {
        nodes: [
          { id: 'p1', title: 'Rum', featuredMedia: { preview: { image: { url: 'r.png' } } }, tracked: { value: 'true' }, variantsCount: { count: 2 } },
          { id: 'p2', title: 'Haiti', featuredMedia: null, tracked: null, variantsCount: { count: 1 } },
        ],
      },
    });
    await expect(searchProductsForFlag(client, { text: 'x' })).resolves.toEqual([
      { id: 'p1', title: 'Rum', imageUrl: 'r.png', tracked: true, variantCount: 2 },
      { id: 'p2', title: 'Haiti', tracked: false, variantCount: 1 },
    ]);
    expect(client.calls[0]?.variables).toMatchObject({ query: 'x', first: 25 });
  });
});
