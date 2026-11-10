import { applyChanges, assemblyChanges, disassemblyChanges } from './apply';
import { MAIN, SHOP, baseStock, dark, kit6, milk } from './fixtures';

describe('assemblyChanges', () => {
  it('consumes components (units x kits) and adds kits', () => {
    const changes = assemblyChanges({ kit: kit6, kitCount: 3, perKit: { [dark.id]: 4, [milk.id]: 2, zero: 0 }, locationId: MAIN });
    expect(changes).toEqual([
      { variantId: 'dark', locationId: MAIN, delta: -12 },
      { variantId: 'milk', locationId: MAIN, delta: -6 },
      { variantId: 'kit6', locationId: MAIN, delta: 3 },
    ]);
  });
});

describe('disassemblyChanges', () => {
  it('removes kits and returns units', () => {
    const changes = disassemblyChanges({ kit: kit6, kitCount: 1, returned: { [dark.id]: 6 }, locationId: MAIN });
    expect(changes).toEqual([
      { variantId: 'kit6', locationId: MAIN, delta: -1 },
      { variantId: 'dark', locationId: MAIN, delta: 6 },
    ]);
  });
});

describe('applyChanges', () => {
  it('returns a new map and leaves the original untouched', () => {
    const before = baseStock();
    const after = applyChanges(before, [{ variantId: 'dark', locationId: MAIN, delta: -5 }]);
    expect(after).not.toBe(before);
    expect(before.dark?.[MAIN]).toBe(20);
    expect(after.dark?.[MAIN]).toBe(15);
    expect(after.dark?.[SHOP]).toBe(5);
  });
  it('activates a variant at a location it was not stocked at', () => {
    const after = applyChanges(baseStock(), [{ variantId: 'kit6', locationId: SHOP, delta: 2 }]);
    expect(after.kit6?.[SHOP]).toBe(2);
    expect(after.kit6?.[MAIN]).toBe(4);
  });
  it('applies multiple changes to the same line cumulatively', () => {
    const after = applyChanges(baseStock(), [
      { variantId: 'dark', locationId: MAIN, delta: -2 },
      { variantId: 'dark', locationId: MAIN, delta: -3 },
    ]);
    expect(after.dark?.[MAIN]).toBe(15);
  });
});
