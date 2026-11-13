import { draftsToTargets, targetsToDrafts, sameTargets } from './targetDrafts';

const W = 'W';
const M = 'M';

describe('targetsToDrafts', () => {
  it('makes text fields for every location, blank where there is no target', () => {
    expect(targetsToDrafts({ [W]: { min: 5, max: 20 } }, [W, M])).toEqual({ [W]: { min: '5', max: '20' }, [M]: { min: '', max: '' } });
  });
});

describe('draftsToTargets', () => {
  it('turns filled pairs into targets and treats a blank pair as none', () => {
    expect(draftsToTargets({ [W]: { min: ' 5 ', max: '20' }, [M]: { min: '', max: '' } })).toEqual({ ok: true, targets: { [W]: { min: 5, max: 20 } } });
  });
  it('accepts 0', () => {
    expect(draftsToTargets({ [W]: { min: '0', max: '0' } })).toEqual({ ok: true, targets: { [W]: { min: 0, max: 0 } } });
  });
  it.each([
    ['only a minimum', { min: '5', max: '' }, 'Enter both a minimum and a maximum.'],
    ['only a maximum', { min: '', max: '5' }, 'Enter both a minimum and a maximum.'],
    ['text', { min: 'a', max: '5' }, 'Minimum must be a whole number.'],
    ['fraction', { min: '1.5', max: '5' }, 'Minimum must be a whole number.'],
    ['max below min', { min: '9', max: '3' }, 'Maximum must be at least the minimum.'],
    ['negative', { min: '-1', max: '3' }, 'Minimum must be 0 or more.'],
  ])('rejects %s and names the location', (_n, draft, message) => {
    expect(draftsToTargets({ [W]: draft })).toEqual({ ok: false, locationId: W, message });
  });
});

describe('sameTargets', () => {
  it('compares by content, not by key order', () => {
    expect(sameTargets({ [W]: { min: 1, max: 2 }, [M]: { min: 3, max: 4 } }, { [M]: { min: 3, max: 4 }, [W]: { min: 1, max: 2 } })).toBe(true);
    expect(sameTargets({ [W]: { min: 1, max: 2 } }, { [W]: { min: 1, max: 3 } })).toBe(false);
    expect(sameTargets({ [W]: { min: 1, max: 2 } }, {})).toBe(false);
  });
});
