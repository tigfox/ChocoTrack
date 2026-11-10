import { parseCount, withCount } from './counts';

describe('withCount', () => {
  it('adds and updates without mutating', () => {
    const a = { x: 1 };
    const b = withCount(a, 'y', 2);
    const c = withCount(b, 'x', 5);
    expect(a).toEqual({ x: 1 });
    expect(b).toEqual({ x: 1, y: 2 });
    expect(c).toEqual({ x: 5, y: 2 });
  });
  it('removes entries set to zero or NaN', () => {
    expect(withCount({ x: 1, y: 2 }, 'x', 0)).toEqual({ y: 2 });
    expect(withCount({ x: 1 }, 'x', Number.NaN)).toEqual({});
  });
  it('keeps fractional values so validation can flag them', () => {
    expect(withCount({}, 'x', 1.5)).toEqual({ x: 1.5 });
  });
});

describe('parseCount', () => {
  it('treats blank as 0 and parses numbers', () => {
    expect(parseCount('')).toBe(0);
    expect(parseCount(' 4 ')).toBe(4);
    expect(parseCount('abc')).toBeNaN();
  });
});
