/** Stock targets for one variant at one location. Both bounds are whole numbers, 0 <= min <= max. */
export interface Target {
  readonly min: number;
  readonly max: number;
}

/** locationId -> target. A location with no entry has no target for the variant. */
export type Targets = Readonly<Record<string, Target>>;

const MAX_QUANTITY = 1_000_000;

/** A message for the first problem with a min/max pair, or undefined when it is valid. */
export const validateTarget = (min: number, max: number): string | undefined => {
  if (!Number.isInteger(min)) return 'Minimum must be a whole number.';
  if (!Number.isInteger(max)) return 'Maximum must be a whole number.';
  if (min < 0) return 'Minimum must be 0 or more.';
  if (max < min) return 'Maximum must be at least the minimum.';
  if (max > MAX_QUANTITY) return 'Maximum must be 1,000,000 or less.';
  return undefined;
};

const isTarget = (v: unknown): v is Target => {
  if (typeof v !== 'object' || v === null) return false;
  const { min, max } = v as Record<string, unknown>;
  return typeof min === 'number' && typeof max === 'number' && validateTarget(min, max) === undefined;
};

/** Reads the metafield value leniently: bad JSON or bad entries are dropped, never thrown. */
export const parseTargets = (raw: string | null | undefined): Targets => {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([locationId, t]) => (isTarget(t) ? [[locationId, { min: t.min, max: t.max }]] : [])),
    );
  } catch {
    return {};
  }
};

/** Stable JSON (sorted keys) for the metafield, or null when there are no targets left. */
export const serializeTargets = (targets: Targets): string | null => {
  const entries = Object.entries(targets).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return entries.length === 0 ? null : JSON.stringify(Object.fromEntries(entries));
};

/** Returns a copy with the location's target set, or removed when `target` is null. */
export const setTarget = (targets: Targets, locationId: string, target: Target | null): Targets => {
  const rest = Object.fromEntries(Object.entries(targets).filter(([id]) => id !== locationId));
  return target === null ? rest : { ...rest, [locationId]: target };
};
