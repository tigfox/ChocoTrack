import { buildPickList } from './pickList';
import { MAIN, SHOP, baseStock, dark, kit6, milk, mint, variantsById } from './fixtures';

const base = { stock: baseStock(), variantsById, kit: kit6, locationId: MAIN };

describe('buildPickList (assemble)', () => {
  it('multiplies the per-kit mix by the number of kits', () => {
    const list = buildPickList({ ...base, mode: 'assemble', kitCount: 3, perKit: { [dark.id]: 4, [milk.id]: 2 } });
    expect(list.rows.map((r) => [r.variantId, r.perKit, r.total, r.available])).toEqual([
      ['dark', 4, 12, 20],
      ['milk', 2, 6, 10],
    ]);
    expect(list.totalUnits).toBe(18);
    expect(list.kitCount).toBe(3);
  });
  it('flags a shortage when the total exceeds what is available', () => {
    const list = buildPickList({ ...base, mode: 'assemble', kitCount: 2, perKit: { [mint.id]: 2, [dark.id]: 4 } });
    expect(list.rows.find((r) => r.variantId === 'mint')?.short).toBe(1);
    expect(list.rows.find((r) => r.variantId === 'dark')?.short).toBe(0);
  });
  it('treats a component not stocked at the location as fully short with unknown availability', () => {
    const list = buildPickList({ ...base, locationId: SHOP, mode: 'assemble', kitCount: 1, perKit: { [milk.id]: 6 } });
    expect(list.rows[0]).toMatchObject({ available: null, short: 6 });
  });
  it('drops zero-quantity lines and works for an in-progress mix', () => {
    const list = buildPickList({ ...base, mode: 'assemble', kitCount: 1, perKit: { [dark.id]: 1, [milk.id]: 0 } });
    expect(list.rows).toHaveLength(1);
    expect(list.totalUnits).toBe(1);
  });
  it('is empty for an empty mix', () => {
    expect(buildPickList({ ...base, mode: 'assemble', kitCount: 1, perKit: {} })).toMatchObject({ rows: [], totalUnits: 0 });
  });
  it('treats an invalid kit count as 0 kits', () => {
    expect(buildPickList({ ...base, mode: 'assemble', kitCount: Number.NaN, perKit: { [dark.id]: 6 } }).totalUnits).toBe(0);
  });
  it('includes SKU and barcode for scanning', () => {
    const [row] = buildPickList({ ...base, mode: 'assemble', kitCount: 1, perKit: { [dark.id]: 6 } }).rows;
    expect(row).toMatchObject({ sku: dark.sku, barcode: dark.barcode, title: dark.title });
  });
});

describe('buildPickList (disassemble)', () => {
  it('lists units returned and never reports shortages', () => {
    const list = buildPickList({ ...base, mode: 'disassemble', kitCount: 2, perKit: { [dark.id]: 3, [milk.id]: 3 } });
    expect(list.totalUnits).toBe(12);
    expect(list.rows.every((r) => r.short === 0)).toBe(true);
    expect(list.rows[0]).toMatchObject({ total: 6 });
  });
});
