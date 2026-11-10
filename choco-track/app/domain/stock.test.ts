import { availableAt, maxBuildable, positiveEntries, sumUnits } from './stock';
import { MAIN, SHOP, baseStock } from './fixtures';

describe('availableAt', () => {
  it('returns the stocked quantity', () => {
    expect(availableAt(baseStock(), 'dark', MAIN)).toBe(20);
  });
  it('returns 0 when stocked at zero', () => {
    expect(availableAt(baseStock(), 'mint', SHOP)).toBe(0);
  });
  it('returns null when not stocked at the location', () => {
    expect(availableAt(baseStock(), 'milk', SHOP)).toBeNull();
  });
  it('returns null for unknown variants', () => {
    expect(availableAt(baseStock(), 'nope', MAIN)).toBeNull();
  });
});

describe('sumUnits / positiveEntries', () => {
  it('sums all counts', () => {
    expect(sumUnits({ a: 2, b: 3 })).toBe(5);
  });
  it('is 0 for empty counts', () => {
    expect(sumUnits({})).toBe(0);
  });
  it('drops zero and negative entries', () => {
    expect(positiveEntries({ a: 0, b: 2, c: -1 })).toEqual([['b', 2]]);
  });
});

describe('maxBuildable', () => {
  it('is limited by the scarcest component', () => {
    // dark 20/3 = 6, mint 3/1 = 3
    expect(maxBuildable(baseStock(), { dark: 3, mint: 1 }, MAIN)).toBe(3);
  });
  it('is 0 when a component is not stocked at the location', () => {
    expect(maxBuildable(baseStock(), { milk: 1 }, SHOP)).toBe(0);
  });
  it('is 0 with no components chosen', () => {
    expect(maxBuildable(baseStock(), {}, MAIN)).toBe(0);
  });
  it('ignores zero-quantity lines', () => {
    expect(maxBuildable(baseStock(), { dark: 2, mint: 0 }, MAIN)).toBe(10);
  });
});
