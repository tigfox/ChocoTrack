import { parseTargets, serializeTargets, setTarget, validateTarget } from './targets';

const W = 'gid://shopify/Location/1';
const M = 'gid://shopify/Location/2';

describe('validateTarget', () => {
  it('accepts whole numbers with 0 <= min <= max', () => {
    expect(validateTarget(0, 0)).toBeUndefined();
    expect(validateTarget(10, 40)).toBeUndefined();
    expect(validateTarget(5, 5)).toBeUndefined();
  });
  it.each([
    ['fractional min', 1.5, 10, 'Minimum must be a whole number.'],
    ['fractional max', 1, 10.5, 'Maximum must be a whole number.'],
    ['negative min', -1, 10, 'Minimum must be 0 or more.'],
    ['max below min', 10, 5, 'Maximum must be at least the minimum.'],
    ['huge max', 0, 1_000_001, 'Maximum must be 1,000,000 or less.'],
    ['NaN', Number.NaN, 5, 'Minimum must be a whole number.'],
  ])('rejects %s', (_n, min, max, message) => {
    expect(validateTarget(min, max)).toBe(message);
  });
});

describe('parseTargets', () => {
  it('reads targets keyed by location id', () => {
    expect(parseTargets(JSON.stringify({ [W]: { min: 10, max: 40 }, [M]: { min: 0, max: 5 } }))).toEqual({
      [W]: { min: 10, max: 40 },
      [M]: { min: 0, max: 5 },
    });
  });
  it.each([[null], [undefined], [''], ['not json'], ['[]'], ['5'], ['null']])('returns none for %j', (raw) => {
    expect(parseTargets(raw)).toEqual({});
  });
  it('drops invalid entries and keeps the valid ones', () => {
    const raw = JSON.stringify({
      [W]: { min: 10, max: 40 },
      bad1: { min: 'x', max: 4 },
      bad2: { min: 9, max: 3 },
      bad3: { min: -1, max: 3 },
      bad4: null,
      bad5: { min: 1 },
      bad6: 7,
    });
    expect(parseTargets(raw)).toEqual({ [W]: { min: 10, max: 40 } });
  });
});

describe('serializeTargets', () => {
  it('writes stable JSON regardless of insertion order', () => {
    const a = serializeTargets({ [W]: { min: 1, max: 2 }, [M]: { min: 3, max: 4 } });
    const b = serializeTargets({ [M]: { min: 3, max: 4 }, [W]: { min: 1, max: 2 } });
    expect(a).toBe(b);
    expect(JSON.parse(a ?? '')).toEqual({ [W]: { min: 1, max: 2 }, [M]: { min: 3, max: 4 } });
  });
  it('returns null when there are no targets, so the metafield can be removed', () => {
    expect(serializeTargets({})).toBeNull();
  });
  it('round-trips through parseTargets', () => {
    const t = { [W]: { min: 2, max: 9 } };
    expect(parseTargets(serializeTargets(t))).toEqual(t);
  });
});

describe('setTarget', () => {
  const start = Object.freeze({ [W]: Object.freeze({ min: 1, max: 2 }) });
  it('adds or replaces a location without changing the original', () => {
    const next = setTarget(start, M, { min: 5, max: 9 });
    expect(next).toEqual({ [W]: { min: 1, max: 2 }, [M]: { min: 5, max: 9 } });
    expect(start).toEqual({ [W]: { min: 1, max: 2 } });
    expect(setTarget(start, W, { min: 3, max: 4 })[W]).toEqual({ min: 3, max: 4 });
  });
  it('removes a location when given null', () => {
    expect(setTarget(start, W, null)).toEqual({});
    expect(setTarget(start, M, null)).toEqual(start);
  });
});
