import { buildProductSetInput } from './riverSeaProductSet';
import type { ExportProduct } from './riverSeaExport';

const product: ExportProduct = {
  handle: 'mini-bars-milks', title: 'Mini Bars - Milks', bodyHtml: '<p>hi</p>', vendor: 'River Sea', category: 'Food > Chocolate', type: '',
  tags: ['Bars'], published: true, status: 'ACTIVE', giftCard: false, optionNames: ['Flavor'], seo: { title: 't', description: 'd' },
  metafields: [{ namespace: 'custom', key: 'cacao', type: 'number_integer', value: '72' }],
  images: [{ src: 'https://cdn.example/a.jpg', alt: 'a', position: 1 }],
  variants: [
    { optionValues: ['organic-milk'], sku: 'MIN-OGM-MLK', barcodes: [{ value: '850092274229', type: 'GTIN' }], grams: 453.59237, tracked: true,
      policy: 'DENY', requiresShipping: true, taxable: true, price: '3.00', compareAt: '4.00', cost: '1.25', image: 'https://cdn.example/a.jpg' },
  ],
};
const ctx = { categoryIds: { 'Food > Chocolate': 'gid://shopify/TaxonomyCategory/fb-2-3-2' }, stockFor: () => [{ locationId: 'gid://loc/F', name: 'available' as const, quantity: 7 }] };

describe('buildProductSetInput', () => {
  const input = buildProductSetInput(product, ctx);
  it('maps product fields', () => {
    expect(input).toMatchObject({ handle: 'mini-bars-milks', title: 'Mini Bars - Milks', descriptionHtml: '<p>hi</p>', vendor: 'River Sea', productType: '', tags: ['Bars'], status: 'ACTIVE', category: 'gid://shopify/TaxonomyCategory/fb-2-3-2', seo: { title: 't', description: 'd' } });
    expect(input.productOptions).toEqual([{ name: 'Flavor', position: 1, values: [{ name: 'organic-milk' }] }]);
    expect(input.files).toEqual([{ originalSource: 'https://cdn.example/a.jpg', alt: 'a', contentType: 'IMAGE' }]);
    expect(input.metafields).toEqual(product.metafields);
  });
  it('maps variant fields', () => {
    expect(input.variants[0]).toMatchObject({
      optionValues: [{ optionName: 'Flavor', name: 'organic-milk' }], sku: 'MIN-OGM-MLK', price: '3.00', compareAtPrice: '4.00', inventoryPolicy: 'DENY', taxable: true,
      barcodes: [{ value: '850092274229', type: 'GTIN' }], file: { originalSource: 'https://cdn.example/a.jpg', contentType: 'IMAGE' },
      inventoryItem: { tracked: true, cost: '1.25', requiresShipping: true, measurement: { weight: { value: 1, unit: 'POUNDS' } } },
      inventoryQuantities: [{ locationId: 'gid://loc/F', name: 'available', quantity: 7 }],
    });
  });
  it('omits optional fields that are blank', () => {
    const bare = buildProductSetInput({ ...product, category: '', images: [], metafields: [], variants: [{ ...(product.variants[0] as ExportProduct['variants'][number]), compareAt: '', cost: '', grams: null, barcodes: [], image: '', tracked: false }] }, { ...ctx, stockFor: () => [] });
    const variant = bare.variants[0] as Record<string, unknown>;
    expect(bare).not.toHaveProperty('category');
    expect(bare).not.toHaveProperty('files');
    expect(variant).not.toHaveProperty('compareAtPrice');
    expect(variant).not.toHaveProperty('file');
    expect(variant).not.toHaveProperty('inventoryQuantities');
    expect(variant.inventoryItem).toEqual({ tracked: false, requiresShipping: true });
  });
  it('turns tracking on for a variant that has stock to set', () => {
    const untracked = { ...(product.variants[0] as ExportProduct['variants'][number]), tracked: false };
    const out = buildProductSetInput({ ...product, variants: [untracked] }, ctx);
    expect((out.variants[0] as { inventoryItem: { tracked: boolean } }).inventoryItem.tracked).toBe(true);
  });
  it('fails on a category with no taxonomy match', () => {
    expect(() => buildProductSetInput(product, { ...ctx, categoryIds: {} })).toThrow(/category/i);
  });
});
