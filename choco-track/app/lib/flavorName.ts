/** Display-name overrides for flavors the matching rule gets wrong or cannot match. */
export const FLAVOR_OVERRIDES: Readonly<Record<string, string>> = {
  'peach-ipa-dark-milk': 'Peach IPA',
  'peru-72': 'Peru 72%',
  'raspberry-vanilla-1': 'Raspberry Vanilla Tea 65%',
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NOISE = new Set(['and', 'the']);

/** A lowercase hyphenated name like "desert-flower": the form the live store uses for mini bar flavors. */
export const isFlavorSlug = (value: string): boolean => SLUG.test(value);

/** "rosemary-olive-oil" becomes "Rosemary Olive Oil". */
export const humanizeFlavor = (slug: string): string =>
  slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const words = (text: string): ReadonlySet<string> =>
  new Set(
    text
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((w) => w !== '' && !NOISE.has(w)),
  );

const containsAll = (outer: ReadonlySet<string>, inner: ReadonlySet<string>): boolean => [...inner].every((w) => outer.has(w));

/**
 * The product title that closely matches a flavor: every word of one name appears in the other
 * (ignoring case, punctuation, "%" and "and"). Several matches: the shortest title wins.
 */
export const matchFlavorName = (flavor: string, titles: readonly string[]): string | undefined => {
  const flavorWords = words(flavor);
  if (flavorWords.size === 0) return undefined;
  return titles
    .filter((t) => {
      const titleWords = words(t);
      return titleWords.size > 0 && (containsAll(titleWords, flavorWords) || containsAll(flavorWords, titleWords));
    })
    .sort((a, b) => a.length - b.length)[0];
};

/** What to show for a flavor: an override, else a closely matching product title, else the humanized flavor. */
export const flavorDisplayName = (
  flavor: string,
  titles: readonly string[],
  overrides: Readonly<Record<string, string>> = FLAVOR_OVERRIDES,
): string => overrides[flavor] ?? matchFlavorName(flavor, titles) ?? humanizeFlavor(flavor);
