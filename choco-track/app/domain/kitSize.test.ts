import { MAX_KIT_SIZE, kitSizeError, parseKitSize } from './kitSize';

describe('kitSizeError', () => {
  it('accepts any whole number from 1 to the largest box', () => {
    for (const n of [1, 4, 7, 8, 12, MAX_KIT_SIZE]) expect(kitSizeError(n)).toBeUndefined();
  });
  it('rejects everything else with one message', () => {
    for (const n of [0, -4, 2.5, MAX_KIT_SIZE + 1, Number.NaN, '6', null, undefined]) {
      expect(kitSizeError(n)).toBe('Enter a whole number from 1 to 48.');
    }
  });
});

describe('parseKitSize', () => {
  it('reads a saved number, and ignores anything unusable', () => {
    expect(parseKitSize('7')).toBe(7);
    for (const raw of [undefined, '', 'x', '0', '2.5', '49']) expect(parseKitSize(raw)).toBeUndefined();
  });
});
