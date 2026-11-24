import { groupProducts, parseBarcodes } from './riverSeaExport';

const row = (o: Record<string, string>): Record<string, string> => o;
const first = row({
  Handle: 'mini-bars-milks', Title: 'Mini Bars - Milks', 'Body (HTML)': '<p>hi</p>', Vendor: 'River Sea', 'Product Category': 'Food > Chocolate',
  Type: '', Tags: 'Bars, Grocery', Published: 'TRUE', 'Option1 Name': 'Flavor', 'Option1 Value': 'organic-milk', 'Variant SKU': '',
  'Variant Grams': '18.0076', 'Variant Inventory Tracker': 'shopify', 'Variant Inventory Policy': 'deny', 'Variant Requires Shipping': 'TRUE',
  'Variant Taxable': 'TRUE', 'Variant Price': '3.00', 'Variant Compare At Price': '', 'Variant Barcodes': 'gtin:850092274229',
  'Image Src': 'https://cdn.example/a.jpg', 'Image Position': '1', 'Image Alt Text': 'alt a', 'Gift Card': 'FALSE', 'SEO Title': 'seo t', 'SEO Description': 'seo d',
  'Cost per item': '1.25', 'Variant Image': 'https://cdn.example/a.jpg', Status: 'active', 'Variant Weight Unit': 'lb',
  'Cacao % (product.metafields.custom.cacao)': '72', 'Tasting Notes (product.metafields.custom.tasting_notes)': 'banana',
  'Allergen information (product.metafields.shopify.allergen-information)': 'milk',
});
const second = row({ Handle: 'mini-bars-milks', 'Option1 Value': 'coconut-milk', 'Variant Price': '3.00', 'Variant Grams': '18.0076', 'Variant Inventory Tracker': '' });
const imageOnly = row({ Handle: 'mini-bars-milks', 'Image Src': 'https://cdn.example/b.jpg', 'Image Position': '2', 'Image Alt Text': '' });

describe('groupProducts', () => {
  const [p] = groupProducts([first, second, imageOnly]);
  it('groups rows by handle into one product', () => {
    expect(groupProducts([first, second, imageOnly])).toHaveLength(1);
    expect(p).toMatchObject({ handle: 'mini-bars-milks', title: 'Mini Bars - Milks', vendor: 'River Sea', status: 'ACTIVE', published: true, giftCard: false });
    expect(p?.tags).toEqual(['Bars', 'Grocery']);
    expect(p?.optionNames).toEqual(['Flavor']);
    expect(p?.seo).toEqual({ title: 'seo t', description: 'seo d' });
  });
  it('turns variant rows into variants and image-only rows into images', () => {
    expect(p?.variants.map((v) => v.optionValues)).toEqual([['organic-milk'], ['coconut-milk']]);
    expect(p?.images).toEqual([
      { src: 'https://cdn.example/a.jpg', alt: 'alt a', position: 1 },
      { src: 'https://cdn.example/b.jpg', alt: '', position: 2 },
    ]);
  });
  it('reads variant fields', () => {
    expect(p?.variants[0]).toMatchObject({
      price: '3.00', tracked: true, policy: 'DENY', requiresShipping: true, taxable: true, grams: 18.0076, cost: '1.25',
      image: 'https://cdn.example/a.jpg', barcodes: [{ value: '850092274229', type: 'GTIN' }],
    });
    expect(p?.variants[1]).toMatchObject({ tracked: false, sku: '' });
  });
  it('keeps only the metafields the dev store can accept, with types', () => {
    expect(p?.metafields).toEqual([
      { namespace: 'custom', key: 'cacao', type: 'number_integer', value: '72' },
      { namespace: 'custom', key: 'tasting_notes', type: 'multi_line_text_field', value: 'banana' },
    ]);
  });
  it('does not change its input rows', () => {
    const frozen = Object.freeze({ ...first });
    expect(() => groupProducts([frozen])).not.toThrow();
  });
});

describe('parseBarcodes', () => {
  it('strips the gtin: prefix and types it', () => {
    expect(parseBarcodes('gtin:850092274229')).toEqual([{ value: '850092274229', type: 'GTIN' }]);
  });
  it('is empty for blank input', () => {
    expect(parseBarcodes('')).toEqual([]);
  });
  it('splits several barcodes on semicolons, typing only the gtin: ones', () => {
    expect(parseBarcodes('gtin:850092274243; MIN-PCH-DMK')).toEqual([{ value: '850092274243', type: 'GTIN' }, { value: 'MIN-PCH-DMK' }]);
  });
  it('passes an unprefixed value through untyped', () => {
    expect(parseBarcodes('TRU-DML-5PK')).toEqual([{ value: 'TRU-DML-5PK' }]);
  });
  it('rejects a gtin: value that is not numeric', () => {
    expect(() => parseBarcodes('gtin:abc')).toThrow(/barcode/i);
  });
});
