import { filterComponents, findExactMatch } from './search';
import { dark, kit6, milk, mint } from './fixtures';

const all = [dark, milk, mint, kit6];

describe('filterComponents', () => {
  it('excludes kits', () => {
    expect(filterComponents(all, { query: '', collectionId: '' })).toEqual([dark, milk, mint]);
  });
  it('matches title case-insensitively', () => {
    expect(filterComponents(all, { query: 'MINT', collectionId: '' })).toEqual([mint]);
  });
  it('matches SKU and barcode', () => {
    expect(filterComponents(all, { query: 'MINI-MILK', collectionId: '' })).toEqual([milk]);
    expect(filterComponents(all, { query: milk.barcode, collectionId: '' })).toEqual([milk]);
  });
  it('filters by collection', () => {
    const other = { ...milk, id: 'x', collectionIds: ['c-full'] };
    expect(filterComponents([dark, other], { query: '', collectionId: 'c-full' })).toEqual([other]);
  });
  it('ignores surrounding whitespace in the query', () => {
    expect(filterComponents(all, { query: '  dark ', collectionId: '' })).toEqual([dark, mint]);
  });
});

describe('findExactMatch', () => {
  it('finds by barcode or SKU, case-insensitively', () => {
    expect(findExactMatch(all, milk.barcode)).toEqual(milk);
    expect(findExactMatch(all, 'mini-dark')).toEqual(dark);
  });
  it('returns undefined for partial or empty input', () => {
    expect(findExactMatch(all, 'dar')).toBeUndefined();
    expect(findExactMatch(all, '')).toBeUndefined();
  });
  it('never matches a kit', () => {
    expect(findExactMatch(all, kit6.sku)).toBeUndefined();
  });
});
