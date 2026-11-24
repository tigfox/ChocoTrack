import { collectionSpecs, MINI_CATEGORIES, STALE_COLLECTION_TITLES } from './riverSeaCollections';
import type { ExportProduct } from './riverSeaExport';

const prod = (handle: string, title: string): ExportProduct => ({ handle, title }) as ExportProduct;
const products = MINI_CATEGORIES.map((c) => prod(c.handle, `Mini Bars - ${c.title} (full title)`));

describe('collectionSpecs', () => {
  const specs = collectionSpecs(products);
  it('starts with a smart Mini bars collection matching every "Mini Bars - " product', () => {
    expect(specs[0]).toEqual({ title: 'Mini bars', rules: [{ column: 'TITLE', relation: 'CONTAINS', condition: 'Mini Bars - ' }] });
  });
  it('adds one collection per mini category holding exactly that product', () => {
    expect(specs.slice(1).map((s) => s.title)).toEqual(['Limited Editions', 'Dark Milks', 'Rare', 'Single Origin', 'Dark', 'Milk', 'White Chocolate']);
    expect(specs[1]).toEqual({
      title: 'Limited Editions',
      rules: [{ column: 'TITLE', relation: 'EQUALS', condition: 'Mini Bars - Limited Editions (full title)' }],
    });
  });
  it('fails when a category product is missing from the export', () => {
    expect(() => collectionSpecs(products.slice(1))).toThrow(/mini-bars-limited-editions/);
  });
  it('lists the old seed collections to remove', () => {
    expect(STALE_COLLECTION_TITLES).toEqual(['Mini bars (not sold individually)', 'Dark chocolate', 'Milk chocolate']);
  });
});
