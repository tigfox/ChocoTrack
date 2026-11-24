import { flavorDisplayName, humanizeFlavor, isFlavorSlug, matchFlavorName } from './flavorName';

const titles = [
  'Bolivia 72%',
  'Puerto Rico 72%',
  'Zorzal 72%',
  'Smoked Salt Milk Chocolate',
  'Hot Chocolate Mix - Milk + Wood Smoked Salt',
  'Salted Caramel Milk Chocolate',
  'El Camino - Olive Oil Dark Chocolate',
  'Desert Flower',
  'Peach IPA (Mountain Peach & Hops)',
  'Raspberry Vanilla Tea 65%',
];

describe('humanizeFlavor', () => {
  it('capitalizes each hyphenated word', () => {
    expect(humanizeFlavor('rosemary-olive-oil')).toBe('Rosemary Olive Oil');
    expect(humanizeFlavor('peru-72')).toBe('Peru 72');
  });
});

describe('isFlavorSlug', () => {
  it.each(['desert-flower', 'peru-72', 'raspberry-vanilla-1', 'organic-milk'])('accepts %s', (v) => expect(isFlavorSlug(v)).toBe(true));
  it.each(['Default Title', '60g Bar', 'Craft Chocolate 12 Bar Sampler', 'Angel Food White Chocolate', ''])('rejects "%s"', (v) =>
    expect(isFlavorSlug(v)).toBe(false),
  );
});

describe('matchFlavorName', () => {
  it('matches when every word of the flavor is in a title', () => {
    expect(matchFlavorName('el-camino', titles)).toBe('El Camino - Olive Oil Dark Chocolate');
    expect(matchFlavorName('salted-caramel', titles)).toBe('Salted Caramel Milk Chocolate');
  });
  it('matches when every word of a title is in the flavor', () => {
    expect(matchFlavorName('zorzal-dominican-republic-72', titles)).toBe('Zorzal 72%');
  });
  it('prefers the shortest of several matching titles', () => {
    expect(matchFlavorName('smoked-salt-milk', titles)).toBe('Smoked Salt Milk Chocolate');
  });
  it('does not match a different bar that shares some words', () => {
    expect(matchFlavorName('smoked-salted-caramel', titles)).toBeUndefined();
  });
  it('ignores case, punctuation, "%" and "and"', () => {
    expect(matchFlavorName('puerto-rico-72', titles)).toBe('Puerto Rico 72%');
    expect(matchFlavorName('desert-flower', ['DESERT  flower!'])).toBe('DESERT  flower!');
  });
  it('matches nothing for empty input', () => {
    expect(matchFlavorName('', titles)).toBeUndefined();
    expect(matchFlavorName('a-b', [])).toBeUndefined();
  });
});

describe('flavorDisplayName', () => {
  it('uses an override first', () => {
    expect(flavorDisplayName('peach-ipa-dark-milk', titles)).toBe('Peach IPA');
    expect(flavorDisplayName('peru-72', titles)).toBe('Peru 72%');
    expect(flavorDisplayName('raspberry-vanilla-1', titles)).toBe('Raspberry Vanilla Tea 65%');
  });
  it('then a matching product title', () => {
    expect(flavorDisplayName('bolivia-72', titles)).toBe('Bolivia 72%');
  });
  it('then the humanized flavor', () => {
    expect(flavorDisplayName('blood-orange-spice', titles)).toBe('Blood Orange Spice');
  });
  it('accepts custom overrides', () => {
    expect(flavorDisplayName('bolivia-72', titles, { 'bolivia-72': 'Bolivia' })).toBe('Bolivia');
  });
});
