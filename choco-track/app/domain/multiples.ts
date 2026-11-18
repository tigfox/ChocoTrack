/** Pack sizes for transfers: a default, plus overrides keyed by variant name (for example "mini"). */
export interface Multiples {
  readonly fallback: number;
  /** Keys are normalised with `nameKey`. */
  readonly byName: Readonly<Record<string, number>>;
}

export const MIN_MULTIPLE = 1;
export const MAX_MULTIPLE = 1000;

/** Full bars ship in 5s and minis in boxes of 100, until the store team changes it on the Settings page. */
export const DEFAULT_MULTIPLES: Multiples = { fallback: 5, byName: { mini: 100 } };

export const nameKey = (name: string): string => name.trim().replace(/\s+/g, ' ').toLowerCase();

export const validateMultiple = (n: number): string | undefined =>
  Number.isInteger(n) && n >= MIN_MULTIPLE && n <= MAX_MULTIPLE
    ? undefined
    : `Enter a whole number from ${MIN_MULTIPLE} to ${MAX_MULTIPLE}.`;

const valid = (n: unknown): n is number => typeof n === 'number' && validateMultiple(n) === undefined;

export const multipleFor = (settings: Multiples, variant: { readonly title: string }): number =>
  settings.byName[nameKey(variant.title)] ?? settings.fallback;

/** Lenient: unusable text gives the built-in defaults, and bad entries are dropped, never an error. */
export const parseMultiples = (raw: string | null | undefined): Multiples => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? '');
  } catch {
    return DEFAULT_MULTIPLES;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return DEFAULT_MULTIPLES;
  const { default: fallback, byName } = parsed as Record<string, unknown>;
  const overrides =
    typeof byName === 'object' && byName !== null && !Array.isArray(byName)
      ? Object.entries(byName).filter(([name, n]) => name !== '' && name === nameKey(name) && valid(n))
      : [];
  return { fallback: valid(fallback) ? fallback : DEFAULT_MULTIPLES.fallback, byName: Object.fromEntries(overrides) as Record<string, number> };
};

/** Sorted keys, so the same settings always produce the same text. */
export const serializeMultiples = (m: Multiples): string =>
  JSON.stringify({ default: m.fallback, byName: Object.fromEntries(Object.entries(m.byName).sort(([a], [b]) => a.localeCompare(b))) });
