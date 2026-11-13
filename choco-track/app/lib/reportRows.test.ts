import { buildReportGroups, limitGroups, variantLabel, type RowFilters } from './reportRows';
import type { ReportProduct, ReportVariant } from '../shopify/trackedCatalog';

const W = 'W';
const M = 'M';
const v = (id: string, title: string, sku: string, targets: ReportVariant['targets'], productTitle = 'Rum Caramel'): ReportVariant => ({
  id,
  productId: 'p1',
  productTitle,
  title,
  sku,
  inventoryItemId: `i-${id}`,
  digest: null,
  targets,
});
const products: ReportProduct[] = [
  {
    id: 'p1',
    title: 'Rum Caramel',
    truncated: false,
    variants: [
      v('mini', 'Mini', 'RUM-M', { [W]: { min: 100, max: 300 }, [M]: { min: 10, max: 30 } }),
      v('full', 'Full', 'RUM-F', {}),
    ],
  },
  { id: 'p2', title: 'Haiti', truncated: true, variants: [v('h', 'Default Title', 'HAITI', { [W]: { min: 5, max: 9 } }, 'Haiti')] },
];
const levels = {
  mini: { [W]: { available: 250, incoming: 0 }, [M]: { available: 4, incoming: 0 } },
  full: { [W]: { available: 9, incoming: 0 } },
  h: { [W]: { available: 7, incoming: 0 } },
};
const base: RowFilters = { search: '', lowOnly: false, showUntargeted: false };
const build = (over: Partial<RowFilters> = {}, locationIds = [W, M]) =>
  buildReportGroups({ products, levels, pending: {}, locationIds, filters: { ...base, ...over } });

describe('buildReportGroups', () => {
  it('groups tracked variants under their product, with a cell for every visible location', () => {
    const { groups } = build();
    expect(groups.map((g) => [g.productTitle, g.rows.map((r) => r.label)])).toEqual([['Rum Caramel', ['Mini']], ['Haiti', ['']]]);
    expect(groups[0]?.rows[0]?.cells[M]).toMatchObject({ status: 'low', available: 4, min: 10, max: 30 });
    expect(groups[0]?.rows[0]?.cells[W]).toMatchObject({ status: 'ok' });
    expect(groups[1]?.truncated).toBe(true);
  });
  it('hides variants with no targets until asked, and counts them', () => {
    expect(build().hiddenUntargeted).toBe(1);
    const shown = build({ showUntargeted: true });
    expect(shown.groups[0]?.rows.map((r) => r.label)).toEqual(['Mini', 'Full']);
    expect(shown.groups[0]?.rows[1]?.cells[W]?.status).toBe('untracked');
    expect(shown.hiddenUntargeted).toBe(1);
  });
  it('limits columns to the visible locations', () => {
    const { groups } = build({}, [W]);
    expect(Object.keys(groups[0]?.rows[0]?.cells ?? {})).toEqual([W]);
  });
  it('searches product, variant name and SKU, all words must match', () => {
    expect(build({ search: 'haiti' }).groups.map((g) => g.productId)).toEqual(['p2']);
    expect(build({ search: 'rum mini' }).groups.map((g) => g.productId)).toEqual(['p1']);
    expect(build({ search: 'RUM-M' }).groups).toHaveLength(1);
    expect(build({ search: 'rum haiti' }).groups).toHaveLength(0);
  });
  it('shows only rows that are low in a visible location when asked', () => {
    expect(build({ lowOnly: true }).groups.map((g) => g.productId)).toEqual(['p1']);
    expect(build({ lowOnly: true }, [W]).groups).toHaveLength(0); // the low cell is in a hidden column
  });
  it('counts rows shown', () => {
    expect(build().rowCount).toBe(2);
    expect(build({ search: 'zzz' }).rowCount).toBe(0);
  });
  it('carries pending drafts into the cells', () => {
    const { groups } = buildReportGroups({ products, levels, pending: { mini: { [M]: 8 } }, locationIds: [M], filters: base });
    expect(groups[0]?.rows[0]?.cells[M]).toMatchObject({ pending: 8, covered: true });
  });
});

describe('variantLabel', () => {
  it('joins product and variant, or uses the product alone for a default variant', () => {
    expect(variantLabel({ productTitle: 'Rum', title: 'Mini' })).toBe('Rum - Mini');
    expect(variantLabel({ productTitle: 'Haiti', title: 'Default Title' })).toBe('Haiti');
  });
});

describe('limitGroups', () => {
  it('keeps whole rows up to the limit, dropping empty groups', () => {
    const { groups } = build({ showUntargeted: true }); // Rum Caramel has 2 rows, Haiti 1
    expect(limitGroups(groups, 3).map((g) => g.rows.length)).toEqual([2, 1]);
    expect(limitGroups(groups, 2).map((g) => g.rows.length)).toEqual([2]);
    expect(limitGroups(groups, 1).map((g) => g.rows.length)).toEqual([1]);
    expect(limitGroups(groups, 0)).toEqual([]);
  });
});
