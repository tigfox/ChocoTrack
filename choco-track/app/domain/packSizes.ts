/**
 * Pack sizes for transfers: a default, plus groups. Each group has a pack size and the variants that ship in it.
 * A variant in no group uses the default. A variant belongs to at most one group.
 */
export interface PackGroup {
  readonly size: number;
  readonly variantIds: readonly string[];
}

export interface PackSizes {
  readonly defaultSize: number;
  readonly groups: readonly PackGroup[];
}

export const MIN_PACK_SIZE = 1;
export const MAX_PACK_SIZE = 1000;
export const MAX_PACK_GROUPS = 20;
export const MAX_PACK_VARIANTS = 2000;

/** Everything ships one at a time until the store team makes groups on the Settings page. */
export const DEFAULT_PACK_SIZES: PackSizes = { defaultSize: 1, groups: [] };

export const validatePackSize = (n: number): string | undefined =>
  Number.isInteger(n) && n >= MIN_PACK_SIZE && n <= MAX_PACK_SIZE
    ? undefined
    : `Enter a whole number from ${MIN_PACK_SIZE} to ${MAX_PACK_SIZE}.`;

const valid = (n: unknown): n is number => typeof n === 'number' && validatePackSize(n) === undefined;

/** The pack size a variant ships in: its group's size (the first group that lists it), else the default. */
export const packSizeFor = (settings: PackSizes, variantId: string): number =>
  settings.groups.find((g) => g.variantIds.includes(variantId))?.size ?? settings.defaultSize;

/** Lenient: unusable text, or the old by-name format, gives the defaults; bad groups and ids are dropped, never an error. */
export const parsePackSizes = (raw: string | null | undefined): PackSizes => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? '');
  } catch {
    return DEFAULT_PACK_SIZES;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return DEFAULT_PACK_SIZES;
  const { default: defaultSize, groups } = parsed as Record<string, unknown>;
  const seen = new Set<string>();
  const kept = (Array.isArray(groups) ? groups : []).flatMap((g): PackGroup[] => {
    if (typeof g !== 'object' || g === null) return [];
    const { size, variantIds } = g as Record<string, unknown>;
    if (!valid(size) || !Array.isArray(variantIds)) return [];
    const ids = variantIds.filter((id): id is string => typeof id === 'string' && id !== '' && !seen.has(id));
    ids.forEach((id) => seen.add(id));
    return [{ size, variantIds: ids }];
  });
  return { defaultSize: valid(defaultSize) ? defaultSize : DEFAULT_PACK_SIZES.defaultSize, groups: kept };
};

export const serializePackSizes = (p: PackSizes): string =>
  JSON.stringify({ default: p.defaultSize, groups: p.groups.map((g) => ({ size: g.size, variantIds: g.variantIds })) });

/** Adds variants to one group and takes them out of every other group. Returns the same list for a bad index. */
export const moveToGroup = <G extends { readonly variantIds: readonly string[] }>(
  groups: readonly G[],
  index: number,
  ids: readonly string[],
): readonly G[] => {
  if (index < 0 || index >= groups.length) return groups;
  const moving = new Set(ids);
  return groups.map((g, i) => {
    if (i !== index) return { ...g, variantIds: g.variantIds.filter((id) => !moving.has(id)) };
    const have = new Set(g.variantIds);
    return { ...g, variantIds: [...g.variantIds, ...[...moving].filter((id) => !have.has(id))] };
  });
};

export const removeFromGroup = <G extends { readonly variantIds: readonly string[] }>(
  groups: readonly G[],
  index: number,
  id: string,
): readonly G[] => groups.map((g, i) => (i === index ? { ...g, variantIds: g.variantIds.filter((x) => x !== id) } : g));
