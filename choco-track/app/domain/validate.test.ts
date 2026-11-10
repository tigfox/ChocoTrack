import { validateAssembly, validateDisassembly } from './validate';
import { MAIN, SHOP, baseStock, dark, kit12, kit6, milk, mint, variantsById } from './fixtures';

const base = { stock: baseStock(), variantsById, locationId: MAIN };
const codes = (issues: readonly { code: string }[]) => issues.map((i) => i.code);

describe('validateAssembly', () => {
  const ok = { ...base, kit: kit6, kitCount: 2, perKit: { [dark.id]: 4, [milk.id]: 2 } };

  it('accepts a valid assembly', () => {
    expect(validateAssembly(ok)).toEqual([]);
  });
  it('requires a location', () => {
    expect(codes(validateAssembly({ ...ok, locationId: '' }))).toContain('NO_LOCATION');
  });
  it('requires a kit', () => {
    expect(codes(validateAssembly({ ...ok, kit: undefined }))).toContain('NO_KIT');
  });
  it.each([0, -1, 1.5, Number.NaN])('rejects kit count %s', (kitCount) => {
    expect(codes(validateAssembly({ ...ok, kitCount }))).toContain('BAD_KIT_COUNT');
  });
  it('requires at least one unit', () => {
    expect(codes(validateAssembly({ ...ok, perKit: {} }))).toContain('NO_UNITS');
  });
  it('requires units per kit to equal the kit size (too few)', () => {
    const issues = validateAssembly({ ...ok, perKit: { [dark.id]: 5 } });
    expect(codes(issues)).toEqual(['WRONG_UNIT_TOTAL']);
    expect(issues[0]?.message).toMatch(/5 of 6/);
  });
  it('requires units per kit to equal the kit size (too many)', () => {
    expect(codes(validateAssembly({ ...ok, kit: kit6, perKit: { [dark.id]: 7 } }))).toContain('WRONG_UNIT_TOTAL');
  });
  it('supports 12-packs', () => {
    expect(validateAssembly({ ...ok, kit: kit12, perKit: { [dark.id]: 6, [milk.id]: 6 }, kitCount: 1 })).toEqual([]);
  });
  it('rejects non-integer or negative unit counts', () => {
    expect(codes(validateAssembly({ ...ok, perKit: { [dark.id]: 6.5, [milk.id]: -0.5 } }))).toContain('INVALID_QUANTITY');
  });
  it('flags a component not stocked at the location', () => {
    const issues = validateAssembly({ ...ok, locationId: SHOP, perKit: { [milk.id]: 6 }, kitCount: 1 });
    expect(codes(issues)).toContain('NOT_STOCKED');
    expect(issues.find((i) => i.code === 'NOT_STOCKED')?.variantId).toBe(milk.id);
  });
  it('flags insufficient stock using units x kit count', () => {
    // mint has 3 at MAIN, 2 per kit x 2 kits = 4
    const issues = validateAssembly({ ...ok, perKit: { [dark.id]: 4, [mint.id]: 2 } });
    expect(codes(issues)).toEqual(['INSUFFICIENT_STOCK']);
    expect(issues[0]?.message).toMatch(/Mint Dark/);
  });
});

describe('validateDisassembly', () => {
  const ok = { ...base, kit: kit6, kitCount: 2, perKit: { [dark.id]: 4, [milk.id]: 2 } };

  it('accepts a valid disassembly', () => {
    expect(validateDisassembly(ok)).toEqual([]);
  });
  it('requires the per-kit mix to equal the kit size, regardless of kit count', () => {
    const issues = validateDisassembly({ ...ok, kitCount: 3, perKit: { [dark.id]: 4 } });
    expect(codes(issues)).toEqual(['WRONG_UNIT_TOTAL']);
    expect(issues[0]?.message).toMatch(/4 of 6/);
  });
  it('requires at least one unit', () => {
    expect(codes(validateDisassembly({ ...ok, perKit: {} }))).toContain('NO_UNITS');
  });
  it('rejects a bad kit count', () => {
    expect(codes(validateDisassembly({ ...ok, kitCount: 0 }))).toContain('BAD_KIT_COUNT');
  });
  it('cannot break down more kits than are in stock', () => {
    const issues = validateDisassembly({ ...ok, kitCount: 5 });
    expect(codes(issues)).toContain('INSUFFICIENT_STOCK');
  });
  it('treats a kit not stocked at the location as insufficient', () => {
    expect(codes(validateDisassembly({ ...ok, locationId: SHOP }))).toContain('INSUFFICIENT_STOCK');
  });
  it('requires a kit and location', () => {
    expect(codes(validateDisassembly({ ...ok, kit: undefined, locationId: '' }))).toEqual(
      expect.arrayContaining(['NO_KIT', 'NO_LOCATION']),
    );
  });
  it('rejects non-integer unit counts', () => {
    expect(codes(validateDisassembly({ ...ok, perKit: { [dark.id]: 1.5 } }))).toContain('INVALID_QUANTITY');
  });
  it('flags returning units to a location where the component is not stocked', () => {
    const ghost = { ...mint, id: 'ghost', title: 'Ghost' };
    const issues = validateDisassembly({ ...ok, perKit: { [dark.id]: 4, ghost: 2 }, variantsById: { ...variantsById, ghost } });
    expect(codes(issues)).toContain('NOT_STOCKED');
  });
});

describe.each([
  ['assembly', validateAssembly],
  ['disassembly', validateDisassembly],
])('%s kit integrity (forged requests)', (_name, validate) => {
  const ok = { ...base, kit: kit6, kitCount: 1, perKit: { [dark.id]: 6 } };

  it('refuses a variant that is not a kit (no kit size)', () => {
    const result = validate({ ...ok, kit: dark, perKit: { [milk.id]: 100 } });
    expect(codes(result)).toContain('NO_KIT');
    expect(result.find((i) => i.code === 'NO_KIT')?.message).toBe('That item is not a kit.');
  });
  it('refuses a kit listed as its own component', () => {
    expect(codes(validate({ ...ok, perKit: { [dark.id]: 5, [kit6.id]: 1 } }))).toContain('KIT_AS_COMPONENT');
  });
});
