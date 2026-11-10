import { runAssembly, runDisassembly } from './workflow';
import { MAIN, baseStock, dark, kit6, milk, variantsById } from './fixtures';

const state = () => ({ stock: baseStock(), variantsById });
const asm = { kit: kit6, kitCount: 2, perKit: { [dark.id]: 4, [milk.id]: 2 }, locationId: MAIN };

describe('runAssembly', () => {
  it('returns new stock and the changes on success', () => {
    const s = state();
    const out = runAssembly(s, asm, { simulateConflict: false });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.stock.kit6?.[MAIN]).toBe(6);
    expect(out.stock.dark?.[MAIN]).toBe(12);
    expect(out.changes).toHaveLength(3);
    expect(s.stock.kit6?.[MAIN]).toBe(4);
  });
  it('returns validation issues without changing stock', () => {
    const out = runAssembly(state(), { ...asm, perKit: { [dark.id]: 1 } }, { simulateConflict: false });
    expect(out.ok).toBe(false);
    if (out.ok || out.kind !== 'validation') throw new Error('expected a validation failure');
    expect(out.issues.length).toBeGreaterThan(0);
  });
  it('simulates a stale-stock conflict by reducing a component and refusing the write', () => {
    const out = runAssembly(state(), asm, { simulateConflict: true });
    expect(out.ok).toBe(false);
    if (out.ok || out.kind !== 'conflict') throw new Error('expected a conflict');
    expect(out.stock.dark?.[MAIN]).toBeLessThan(20);
  });
});

describe('runDisassembly', () => {
  const dis = { kit: kit6, kitCount: 1, returned: { [dark.id]: 3, [milk.id]: 3 }, locationId: MAIN };
  it('returns kits to components', () => {
    const out = runDisassembly(state(), dis, { simulateConflict: false });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.stock.kit6?.[MAIN]).toBe(3);
    expect(out.stock.dark?.[MAIN]).toBe(23);
  });
  it('rejects invalid input', () => {
    const out = runDisassembly(state(), { ...dis, returned: {} }, { simulateConflict: false });
    expect(out.ok).toBe(false);
  });
  it('simulates a conflict', () => {
    const out = runDisassembly(state(), dis, { simulateConflict: true });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.kind).toBe('conflict');
  });
});
