import type { ExportProduct, ExportVariant } from './riverSeaExport';
import { miniDisplayName, nonMiniTitles } from './riverSeaNames';

const variant = (flavor: string): ExportVariant => ({ optionValues: [flavor] }) as unknown as ExportVariant;
const product = (handle: string, title = 'T'): ExportProduct => ({ handle, title }) as ExportProduct;
const titles = ['Bolivia 72%', 'Desert Flower'];

describe('nonMiniTitles', () => {
  it('lists titles of products that are not mini products', () => {
    expect(nonMiniTitles([product('bolivia-72', 'Bolivia 72%'), product('mini-bars-rare', 'Mini Bars - Rare'), product('mini-packs', '4 Bar Mini Gift Bag')])).toEqual(['Bolivia 72%']);
  });
});

describe('miniDisplayName', () => {
  it('names a flavor variant of a mini category product', () => {
    expect(miniDisplayName(product('mini-bars-rare'), variant('bolivia-72'), titles)).toBe('Bolivia 72%');
    expect(miniDisplayName(product('mini-bars-limited-editions'), variant('blood-orange-spice'), titles)).toBe('Blood Orange Spice');
    expect(miniDisplayName(product('mini-bars-dark-milks'), variant('peach-ipa-dark-milk'), titles)).toBe('Peach IPA');
  });
  it('leaves other products alone', () => {
    expect(miniDisplayName(product('bolivia-72'), variant('60g Bar'), titles)).toBeUndefined();
    expect(miniDisplayName(product('mini-sampler-box'), variant('desert-flower'), titles)).toBeUndefined();
  });
  it('leaves variants that already have a readable name alone', () => {
    expect(miniDisplayName(product('mini-bars-white-chocolate'), variant('Angel Food White Chocolate'), titles)).toBeUndefined();
  });
});
