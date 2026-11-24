import { applySkus, parseSkuCsv } from './riverSeaSkus';
import type { ExportProduct } from './riverSeaExport';

const v = (flavor: string, sku = ''): ExportProduct['variants'][number] => ({
  optionValues: [flavor], sku, barcodes: [], grams: null, tracked: false, policy: 'DENY', requiresShipping: true, taxable: true, price: '1.00', compareAt: '', cost: '', image: '',
});
const prod = (handle: string, variants: ExportProduct['variants']): ExportProduct => ({
  handle, title: handle, bodyHtml: '', vendor: '', category: '', type: '', tags: [], published: true, status: 'ACTIVE', giftCard: false, optionNames: ['Flavor'],
  seo: { title: '', description: '' }, metafields: [], images: [], variants,
});
const csv = 'Product Type,Flavor,,Barcode\nRare,,,\n,peru-72,,MIN-PER-RAR\n,bolivia-72,,MIN-BOL-RAR\n';
const handles = { Rare: 'mini-bars-rare' };

describe('parseSkuCsv', () => {
  it('reads category sections into {category, flavor, sku}', () => {
    expect(parseSkuCsv(csv)).toEqual([
      { category: 'Rare', flavor: 'peru-72', sku: 'MIN-PER-RAR' },
      { category: 'Rare', flavor: 'bolivia-72', sku: 'MIN-BOL-RAR' },
    ]);
  });
  it('rejects a duplicate SKU', () => {
    expect(() => parseSkuCsv('h,,,\nRare,,,\n,a,,X\n,b,,X\n')).toThrow(/duplicate/i);
  });
});

describe('applySkus', () => {
  it('returns new products with the SKU set on the matching flavor variant', () => {
    const input = [prod('mini-bars-rare', [v('peru-72'), v('bolivia-72')]), prod('other', [v('peru-72')])];
    const out = applySkus(input, parseSkuCsv(csv), handles);
    expect(out[0]?.variants.map((x) => x.sku)).toEqual(['MIN-PER-RAR', 'MIN-BOL-RAR']);
    expect(out[1]?.variants[0]?.sku).toBe('');
    expect(input[0]?.variants[0]?.sku).toBe('');
  });
  it('fails when a SKU row has no matching variant', () => {
    expect(() => applySkus([prod('mini-bars-rare', [v('peru-72')])], parseSkuCsv(csv), handles)).toThrow(/bolivia-72/);
  });
  it('fails when a category has no product handle mapping', () => {
    expect(() => applySkus([], parseSkuCsv(csv), {})).toThrow(/Rare/);
  });
});
