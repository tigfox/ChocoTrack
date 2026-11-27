import type { InventoryReport, ReportVariant } from '../shopify/trackedCatalog';
import { setupFacts } from './setupFacts';

const L = 'gid://shopify/Location/1';
const variant = (id: string, over: Partial<ReportVariant> = {}): ReportVariant => ({
  id, productId: 'p', productTitle: 'Rum', title: id, sku: id, inventoryItemId: `i${id}`, digest: null, targets: { [L]: { min: 10, max: 20 } }, ...over,
});
const report = (variants: ReportVariant[], sourceIds: string[] = [], available = 2): Pick<InventoryReport, 'products' | 'levels' | 'pending' | 'sourceIds'> => ({
  products: variants.length ? [{ id: 'p', title: 'Rum', truncated: false, variants }] : [],
  levels: Object.fromEntries(variants.map((v) => [v.id, { [L]: { available, incoming: 0 } }])),
  pending: {},
  sourceIds,
});

describe('setupFacts', () => {
  it('is all zero for an empty install', () => {
    expect(setupFacts(report([]))).toEqual({ flaggedProducts: 0, monitoredVariants: 0, lowVariants: 0, sourcesSaved: false });
  });
  it('counts flagged products, monitored variants, low variants and sources', () => {
    expect(setupFacts(report([variant('a'), variant('b')], [L]))).toEqual({ flaggedProducts: 1, monitoredVariants: 2, lowVariants: 2, sourcesSaved: true });
  });
  it('ignores variants without targets or switched off', () => {
    const facts = setupFacts(report([variant('a'), variant('b', { targets: {} }), variant('c', { untracked: true })]));
    expect(facts).toMatchObject({ monitoredVariants: 1, lowVariants: 1 });
  });
  it('counts a flagged product whose variants have no targets', () => {
    expect(setupFacts(report([variant('a', { targets: {} })]))).toMatchObject({ flaggedProducts: 1, monitoredVariants: 0 });
  });
});
