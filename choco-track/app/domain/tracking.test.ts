import { cellView, lowSummary, productsWithoutTargets, type FlaggedProduct, type TrackedVariant } from './tracking';

const W = 'gid://shopify/Location/1';
const M = 'gid://shopify/Location/2';
const C = 'gid://shopify/Location/3';

const variant = (id: string, targets: TrackedVariant['targets']): TrackedVariant => ({
  id,
  productId: `p-${id}`,
  productTitle: `Product ${id}`,
  title: 'Mini',
  sku: id.toUpperCase(),
  targets,
});

describe('cellView', () => {
  const target = { min: 10, max: 40 };
  it('is untracked when there is no target, whatever the stock', () => {
    expect(cellView(undefined, { available: 5, incoming: 0 })).toMatchObject({ status: 'untracked', available: 5, stocked: true });
    expect(cellView(undefined, undefined)).toMatchObject({ status: 'untracked', available: 0, stocked: false });
  });
  it('is low below the minimum, ok within range (inclusive), over above the maximum', () => {
    expect(cellView(target, { available: 9, incoming: 0 }).status).toBe('low');
    expect(cellView(target, { available: 10, incoming: 0 }).status).toBe('ok');
    expect(cellView(target, { available: 40, incoming: 0 }).status).toBe('ok');
    expect(cellView(target, { available: 41, incoming: 0 }).status).toBe('over');
  });
  it('treats a location that does not stock the item as 0 available', () => {
    expect(cellView(target, undefined)).toMatchObject({ status: 'low', available: 0, stocked: false });
    expect(cellView({ min: 0, max: 5 }, undefined).status).toBe('ok');
  });
  it('carries the target and the incoming and pending quantities', () => {
    expect(cellView(target, { available: 3, incoming: 4 }, 5)).toMatchObject({ min: 10, max: 40, incoming: 4, pending: 5 });
  });
  it('marks a low cell as covered when incoming plus pending reach the minimum', () => {
    expect(cellView(target, { available: 3, incoming: 4 }, 3).covered).toBe(true);
    expect(cellView(target, { available: 3, incoming: 4 }, 2).covered).toBe(false);
    expect(cellView(target, { available: 12, incoming: 0 }).covered).toBe(false);
  });
});

describe('lowSummary', () => {
  const variants = [
    variant('a', { [W]: { min: 10, max: 40 }, [M]: { min: 10, max: 40 } }),
    variant('b', { [M]: { min: 5, max: 20 } }),
    variant('c', {}),
  ];
  const levels = {
    a: { [W]: { available: 50, incoming: 0 }, [M]: { available: 2, incoming: 0 } },
    b: { [M]: { available: 1, incoming: 10 } },
    c: { [M]: { available: 0, incoming: 0 } },
  };
  it('counts variants with any low cell, the low cells, and those not already covered', () => {
    expect(lowSummary(variants, levels, {})).toEqual({ variants: 2, cells: 2, uncoveredVariants: 1 });
  });
  it('counts pending drafts toward coverage', () => {
    expect(lowSummary(variants, levels, { a: { [M]: 8 } })).toEqual({ variants: 2, cells: 2, uncoveredVariants: 0 });
  });
  it('ignores locations without a target and variants with no targets', () => {
    expect(lowSummary([variant('c', {})], levels, {})).toEqual({ variants: 0, cells: 0, uncoveredVariants: 0 });
  });
  it('counts a variant once however many of its locations are low', () => {
    const both = { a: { [W]: { available: 0, incoming: 0 }, [M]: { available: 0, incoming: 0 } } };
    expect(lowSummary([variants[0] as TrackedVariant], both, {})).toEqual({ variants: 1, cells: 2, uncoveredVariants: 1 });
  });
  it('treats a missing level as 0 available', () => {
    expect(lowSummary([variant('z', { [C]: { min: 1, max: 2 } })], {}, {})).toEqual({ variants: 1, cells: 1, uncoveredVariants: 1 });
  });
});

describe('productsWithoutTargets', () => {
  it('lists flagged products where no variant has a target', () => {
    const products: FlaggedProduct[] = [
      { id: 'p1', title: 'One', variants: [{ targets: {} }, { targets: {} }] },
      { id: 'p2', title: 'Two', variants: [{ targets: {} }, { targets: { [W]: { min: 1, max: 2 } } }] },
      { id: 'p3', title: 'Three', variants: [] },
    ];
    expect(productsWithoutTargets(products)).toEqual([
      { id: 'p1', title: 'One' },
      { id: 'p3', title: 'Three' },
    ]);
  });
});
