import { navLabel } from './navLabel';

describe('navLabel', () => {
  it('is plain when nothing is low', () => {
    expect(navLabel(undefined)).toBe('Inventory');
    expect(navLabel({ count: 0, setupNeeded: false })).toBe('Inventory');
  });
  it('shows the low count', () => {
    expect(navLabel({ count: 3, setupNeeded: false })).toBe('Inventory (3)');
  });
  it('asks for setup instead of a count while setup is unfinished', () => {
    expect(navLabel({ count: 0, setupNeeded: true })).toBe('Inventory (setup)');
    expect(navLabel({ count: 5, setupNeeded: true })).toBe('Inventory (setup)');
  });
});
