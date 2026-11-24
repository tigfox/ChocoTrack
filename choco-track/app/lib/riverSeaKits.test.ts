import type { ExportProduct, ExportVariant } from './riverSeaExport';
import { kitSizeFor } from './riverSeaKits';

const variant = (name: string, tracked = true): ExportVariant => ({
  optionValues: [name], sku: '', barcodes: [], grams: null, tracked, policy: 'DENY', requiresShipping: true, taxable: true, price: '1.00', compareAt: '', cost: '', image: '',
});
const product = (handle: string, title: string): Pick<ExportProduct, 'handle' | 'title'> => ({ handle, title });

describe('kitSizeFor', () => {
  it('reads the size from the product name for a known kit product', () => {
    expect(kitSizeFor(product('mini-sampler-box', '12 Bar Mini Sampler Box'), variant('Craft Chocolate 12 Bar Sampler'))).toBe(12);
    expect(kitSizeFor(product('mini-bar-5-pack', '5 Bar Mini Pack'), variant('Default Title'))).toBe(5);
  });
  it('reads a variant-specific size when the variant names one', () => {
    expect(kitSizeFor(product('mini-bars-assorted', 'Mini Bars (Assorted)'), variant('4 Minis (Milk Flavors)'))).toBe(4);
  });
  it('skips variants of a kit product that name no size', () => {
    expect(kitSizeFor(product('mini-bars-assorted', 'Mini Bars (Assorted)'), variant('Any Flavor'))).toBeUndefined();
  });
  it('skips products that are not in the kit list', () => {
    expect(kitSizeFor(product('truffles-5-pack', 'Truffles 5 Piece'), variant('Default Title'))).toBeUndefined();
    expect(kitSizeFor(product('mini-bars-rare', 'Mini Bars - Rare'), variant('peru-72'))).toBeUndefined();
  });
  it('skips untracked variants, because a kit must track inventory', () => {
    expect(kitSizeFor(product('mini-sampler-box', '12 Bar Mini Sampler Box'), variant('x', false))).toBeUndefined();
  });
});
