import { buildSearchQuery, listCollections, listKits, searchVariants, toCatalogVariant, type VariantNode } from './catalog';
import { fakeClient } from './fakeClient';

const node = (over: Partial<VariantNode> = {}, product: Partial<VariantNode['product']> = {}): VariantNode => ({
  id: 'gid://shopify/ProductVariant/1',
  title: 'Default Title',
  sku: 'MINI-RUM',
  barcode: '850',
  image: null,
  inventoryItem: { id: 'gid://shopify/InventoryItem/9' },
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
    expect(buildSearchQuery('a" OR (sku:*)')).toBe('a OR sku');
  });
  it('keeps scanned barcodes and SKUs intact', () => {
    expect(buildSearchQuery('MINI-RUM_1')).toBe('MINI-RUM_1');
  });
});

describe('searchVariants', () => {
  it('sends the built query and maps nodes', async () => {
    const client = fakeClient({ productVariants: { nodes: [node()] } });
    const result = await searchVariants(client, { text: 'rum', collectionId: 'gid://shopify/Collection/42', first: 10 });
    expect(result.map((v) => v.sku)).toEqual(['MINI-RUM']);
    expect(client.calls[0]?.variables).toEqual({ query: 'collection:42 AND rum', first: 10 });
  });
  it('searches everything by default', async () => {
    const client = fakeClient({ productVariants: { nodes: [] } });
    await searchVariants(client);
    expect(client.calls[0]?.variables).toEqual({ query: null, first: 50 });
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
    const kits = await listKits(client);
    expect(kits.map((k) => [k.sku, k.kitSize, k.title])).toEqual([['SMP-6', 6, 'Sampler Kit - 6 Pack']]);
  });
});

it('listCollections maps id and title', async () => {
  const client = fakeClient({ collections: { nodes: [{ id: 'c1', title: 'Dark', extra: 1 }] } });
  await expect(listCollections(client)).resolves.toEqual([{ id: 'c1', title: 'Dark' }]);
});
