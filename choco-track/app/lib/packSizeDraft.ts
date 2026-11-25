import { validatePackSize, type PackSizes } from '../domain/packSizes';

/** What the pack size card holds while the person edits: sizes are text, because a field can be empty or half typed. */
export interface DraftGroup {
  /** Stable React key, so removing a group does not shuffle the fields of the others. */
  readonly key: number;
  readonly size: string;
  readonly variantIds: readonly string[];
}

export interface PackSizeDraft {
  readonly defaultSize: string;
  readonly groups: readonly DraftGroup[];
}

export const toDraft = (p: PackSizes): PackSizeDraft => ({
  defaultSize: String(p.defaultSize),
  groups: p.groups.map((g, key) => ({ key, size: String(g.size), variantIds: g.variantIds })),
});

/** Only call this when `draftError` is undefined. */
export const fromDraft = (d: PackSizeDraft): PackSizes => ({
  defaultSize: Number(d.defaultSize),
  groups: d.groups.map((g) => ({ size: Number(g.size), variantIds: g.variantIds })),
});

export const addGroup = (d: PackSizeDraft): PackSizeDraft => ({
  ...d,
  groups: [...d.groups, { key: Math.max(-1, ...d.groups.map((g) => g.key)) + 1, size: '', variantIds: [] }],
});

export const removeGroup = (d: PackSizeDraft, index: number): PackSizeDraft => ({ ...d, groups: d.groups.filter((_, i) => i !== index) });

export const setGroupSize = (d: PackSizeDraft, index: number, size: string): PackSizeDraft => ({
  ...d,
  groups: d.groups.map((g, i) => (i === index ? { ...g, size } : g)),
});

/** The first thing wrong with the draft, in words for the screen, or undefined when it can be saved. */
export const draftError = (d: PackSizeDraft): string | undefined => {
  const defaultProblem = validatePackSize(Number(d.defaultSize)); // an empty field is 0, which is out of range
  if (defaultProblem) return defaultProblem;
  if (d.groups.some((g) => g.size.trim() === '')) return 'Enter a pack size for every group.';
  return d.groups.map((g) => validatePackSize(Number(g.size))).find((problem) => problem !== undefined);
};

export const sameDraft = (a: PackSizeDraft, b: PackSizeDraft): boolean =>
  a.defaultSize === b.defaultSize &&
  a.groups.length === b.groups.length &&
  a.groups.every((g, i) => g.size === b.groups[i]?.size && g.variantIds.length === b.groups[i]?.variantIds.length && g.variantIds.every((id, j) => id === b.groups[i]?.variantIds[j]));
