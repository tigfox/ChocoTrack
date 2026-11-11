import { buildSearchQuery, getVariants, listCollections, listKits, searchVariants, toCatalogVariant, type VariantNode } from './catalog';
import { fakeClient } from './fakeClient';

const node = (over: Partial<VariantNode> = {}, product: Partial<VariantNode['product']> = {}): VariantNode => ({
  id: 'gid://shopify/ProductVariant/1',
  title: 'Default Title',
  sku: 'MINI-RUM',
  barcode: '850',
  image: null,
  inventoryItem: { id: 'gid://shopify/InventoryItem/9', inventoryLevels: { nodes: [{ location: { id: 'L1' }, quantities: [{ quantity: 7 }] }] } },
  product: {
    title: 'Mini - Rum Caramel',
    featuredMedia: null,
    collections: { nodes: [{ id: 'c1' }] },
    kitSize: null,
    ...product,
  },
  ...over,
});

describe('toCatalogVariant', () => {
  it('maps a single-variant product', () => {
    expect(toCatalogVariant(node())).toEqual({
      id: 'gid://shopify/ProductVariant/1',
      inventoryItemId: 'gid://shopify/InventoryItem/9',
      title: 'Mini - Rum Caramel',
      sku: 'MINI-RUM',
      barcode: '850',
      collectionIds: ['c1'],
    });
  });
  it('appends the variant title for multi-variant products', () => {
    expect(toCatalogVariant(node({ title: 'Large' })).title).toBe('Mini - Rum Caramel - Large');
  });
  it('prefers the variant image, then the product image', () => {
    const featured = { preview: { image: { url: 'p.png' } } };
    expect(toCatalogVariant(node({ image: { url: 'v.png' } }, { featuredMedia: featured })).imageUrl).toBe('v.png');
    expect(toCatalogVariant(node({}, { featuredMedia: featured })).imageUrl).toBe('p.png');
    expect(toCatalogVariant(node()).imageUrl).toBeUndefined();
  });
  it('defaults missing sku and barcode to empty strings', () => {
    const v = toCatalogVariant(node({ sku: null, barcode: null }));
    expect([v.sku, v.barcode]).toEqual(['', '']);
  });
  it('reads the kit category (a collection id) when set', () => {
    expect(toCatalogVariant(node({}, { category: { value: 'gid://shopify/Collection/5' } })).categoryId).toBe('gid://shopify/Collection/5');
    expect(toCatalogVariant(node({}, { category: null })).categoryId).toBeUndefined();
    expect(toCatalogVariant(node()).categoryId).toBeUndefined();
  });
  it('reads the kit size only when valid', () => {
    expect(toCatalogVariant(node({}, { kitSize: { value: '5' } })).kitSize).toBe(5);
    expect(toCatalogVariant(node({}, { kitSize: { value: '7' } })).kitSize).toBeUndefined();
    expect(toCatalogVariant(node({}, { kitSize: { value: 'x' } })).kitSize).toBeUndefined();
  });
});

describe('buildSearchQuery', () => {
  it('is null with nothing to filter', () => {
    expect(buildSearchQuery('  ')).toBeNull();
  });
  it('combines collection and text', () => {
    expect(buildSearchQuery('rum', 'gid://shopify/Collection/42')).toBe('collection:42 AND rum');
  });
  it('strips search operators from user input', () => {
    expect(buildSearchQuery('a" OR (sku:*)')).toBe('a sku');
  });
  it('drops boolean keywords and negation', () => {
    expect(buildSearchQuery('rum NOT caramel -dark and')).toBe('rum caramel dark');
    expect(buildSearchQuery('OR AND')).toBeNull();
  });
  it('keeps scanned barcodes and SKUs intact', () => {
    expect(buildSearchQuery('MINI-RUM_1')).toBe('MINI-RUM_1');
  });
});

describe('searchVariants', () => {
  it('sends the built query and maps nodes', async () => {
    const client = fakeClient({ productVariants: { nodes: [node()] } });
    const result = await searchVariants(client, { text: 'rum', collectionId: 'gid://shopify/Collection/42', first: 10 });
    expect(result.variants.map((v) => v.sku)).toEqual(['MINI-RUM']);
    expect(client.calls[0]?.variables).toEqual({ query: 'collection:42 AND rum', first: 10 });
  });
  it('returns each variant\'s stock from the same query', async () => {
    const client = fakeClient({ productVariants: { nodes: [node()] } });
    const result = await searchVariants(client);
    expect(result.stock).toEqual({ 'gid://shopify/ProductVariant/1': { L1: 7 } });
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.query).toContain('inventoryLevels');
  });
  it('searches everything by default', async () => {
    const client = fakeClient({ productVariants: { nodes: [] } });
    await searchVariants(client);
    expect(client.calls[0]?.variables).toEqual({ query: null, first: 50 });
  });
});

describe('stock extraction', () => {
  it('omits stock for nodes that were fetched without levels', async () => {
    const withoutLevels = node({ inventoryItem: { id: 'i' } });
    const client = fakeClient({ productVariants: { nodes: [withoutLevels] } });
    await expect(searchVariants(client)).resolves.toMatchObject({ stock: {} });
  });
  it('records an empty entry for a variant stocked nowhere', async () => {
    const nowhere = node({ inventoryItem: { id: 'i', inventoryLevels: { nodes: [] } } });
    const client = fakeClient({ productVariants: { nodes: [nowhere] } });
    await expect(searchVariants(client)).resolves.toMatchObject({ stock: { 'gid://shopify/ProductVariant/1': {} } });
  });
  it('treats a level with no available quantity as 0', async () => {
    const odd = node({ inventoryItem: { id: 'i', inventoryLevels: { nodes: [{ location: { id: 'L1' }, quantities: [] }] } } });
    const client = fakeClient({ productVariants: { nodes: [odd] } });
    await expect(searchVariants(client)).resolves.toMatchObject({ stock: { 'gid://shopify/ProductVariant/1': { L1: 0 } } });
  });
});

describe('listKits', () => {
  it('returns only variants with a valid kit size', async () => {
    const { product: p, ...variant } = node({ id: 'k', title: 'Default Title', sku: 'SMP-6' });
    const client = fakeClient({
      products: {
        nodes: [
          { ...p, title: 'Sampler Kit - 6 Pack', kitSize: { value: '6' }, variants: { nodes: [variant] } },
          { ...p, title: 'Not a kit', kitSize: null, variants: { nodes: [variant] } },
        ],
      },
    });
    const { variants: kits, stock } = await listKits(client);
    expect(kits.map((k) => [k.sku, k.kitSize, k.title])).toEqual([['SMP-6', 6, 'Sampler Kit - 6 Pack']]);
    expect(stock).toEqual({ k: { L1: 7 } });
    expect(client.calls[0]?.query).toContain('inventoryLevels');
  });
});

it('listCollections maps id and title', async () => {
  const client = fakeClient({ collections: { nodes: [{ id: 'c1', title: 'Dark', extra: 1 }] } });
  await expect(listCollections(client)).resolves.toEqual([{ id: 'c1', title: 'Dark' }]);
});

describe('getVariants', () => {
  it('looks up variants by id, skipping missing ones', async () => {
    const client = fakeClient({ nodes: [node(), null, {}] });
    const found = await getVariants(client, ['a', 'b', 'c']);
    expect(found.variants.map((v) => v.sku)).toEqual(['MINI-RUM']);
    expect(found.stock).toEqual({ 'gid://shopify/ProductVariant/1': { L1: 7 } });
    expect(client.calls[0]?.variables).toEqual({ ids: ['a', 'b', 'c'] });
  });
  it('makes no call for an empty list', async () => {
    const client = fakeClient();
    await expect(getVariants(client, [])).resolves.toEqual({ variants: [], stock: {} });
    expect(client.calls).toHaveLength(0);
  });
});
