import {
  DEFAULT_MULTIPLES,
  multipleFor,
  nameKey,
  parseMultiples,
  serializeMultiples,
  validateMultiple,
  type Multiples,
} from './multiples';

describe('validateMultiple', () => {
  it('accepts whole numbers from 1 to 1000', () => {
    for (const n of [1, 5, 100, 1000]) expect(validateMultiple(n)).toBeUndefined();
  });
  it('rejects anything else with a message', () => {
    for (const n of [0, -5, 2.5, 1001, Number.NaN, Number.POSITIVE_INFINITY]) expect(validateMultiple(n)).toMatch(/whole number/);
  });
});

describe('multipleFor', () => {
  const settings: Multiples = { fallback: 5, byName: { mini: 100 } };
  it('uses the override for the variant name, ignoring case and spacing', () => {
    expect(multipleFor(settings, { title: 'Mini' })).toBe(100);
    expect(multipleFor(settings, { title: '  MINI ' })).toBe(100);
  });
  it('uses the default for every other variant, including single-variant products', () => {
    expect(multipleFor(settings, { title: 'Full' })).toBe(5);
    expect(multipleFor(settings, { title: 'Default Title' })).toBe(5);
  });
});

describe('parseMultiples', () => {
  it('reads saved JSON', () => {
    expect(parseMultiples('{"default":10,"byName":{"mini":50}}')).toEqual({ fallback: 10, byName: { mini: 50 } });
  });
  it('falls back to the built-in defaults when nothing is saved or the text is unusable', () => {
    for (const raw of [null, undefined, '', 'nope', '[]', '7', 'null']) expect(parseMultiples(raw)).toEqual(DEFAULT_MULTIPLES);
  });
  it('drops bad entries instead of failing', () => {
    expect(parseMultiples('{"default":0,"byName":{"mini":2.5,"full":20,"":5,"x":"y"}}')).toEqual({ fallback: 5, byName: { full: 20 } });
    expect(parseMultiples('{"default":10,"byName":[]}')).toEqual({ fallback: 10, byName: {} });
  });
  it('ships minis in boxes of 100 and everything else in 5s until changed', () => {
    expect(DEFAULT_MULTIPLES).toEqual({ fallback: 5, byName: { mini: 100 } });
  });
});

describe('serializeMultiples', () => {
  it('writes sorted keys so the same settings give the same text', () => {
    const a = serializeMultiples({ fallback: 5, byName: { mini: 100, full: 10 } });
    const b = serializeMultiples({ fallback: 5, byName: { full: 10, mini: 100 } });
    expect(a).toBe(b);
    expect(parseMultiples(a)).toEqual({ fallback: 5, byName: { full: 10, mini: 100 } });
  });
});

describe('nameKey', () => {
  it('trims, lowercases and collapses spaces', () => {
    expect(nameKey('  Big   Box ')).toBe('big box');
  });
});
