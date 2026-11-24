import { guessKitSize } from './guessKitSize';

describe('guessKitSize', () => {
  it.each([
    ['12 Bar Mini Sampler Box', 12],
    ['6 Bar Mini Single-Origin Select Box', 6],
    ['5 Bar Mini Pack', 5],
    ['Mini Bars (Assorted) - 4 Minis (Mix of Milk & Dark Flavors)', 4],
    ['4 Bar Mini Gift Bag', 4],
    ['3-bar sampler', 3],
  ])('reads the bar count from "%s"', (title, size) => {
    expect(guessKitSize(title)).toBe(size);
  });
  it.each([
    ['no number', 'Mini Bars (Assorted)'],
    ['a weight, not a count', '60g Bar'],
    ['too many for a kit', 'Mini Bars Box of 500'],
    ['a count outside the kit range', '100 Bar Mini Case'],
    ['a different product type', 'Truffles 10 Piece'],
    ['empty', ''],
  ])('gives nothing for %s', (_n, title) => {
    expect(guessKitSize(title)).toBeUndefined();
  });
});
