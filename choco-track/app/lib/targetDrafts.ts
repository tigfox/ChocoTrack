import { validateTarget, type Targets } from '../domain/targets';

/** What the person has typed for one location: text, because a field can be half filled. */
export interface TargetDraft {
  readonly min: string;
  readonly max: string;
}

export type Drafts = Readonly<Record<string, TargetDraft>>;

export const targetsToDrafts = (targets: Targets, locationIds: readonly string[]): Drafts =>
  Object.fromEntries(
    locationIds.map((id) => {
      const t = targets[id];
      return [id, t ? { min: String(t.min), max: String(t.max) } : { min: '', max: '' }];
    }),
  );

export type DraftResult =
  | { readonly ok: true; readonly targets: Targets }
  | { readonly ok: false; readonly locationId: string; readonly message: string };

const WHOLE = /^-?\d+(\.\d+)?$/;

/** A blank pair means "no target here"; a half-filled or invalid pair is reported with its location. */
export const draftsToTargets = (drafts: Drafts): DraftResult => {
  let targets: Targets = {};
  for (const [locationId, draft] of Object.entries(drafts)) {
    const min = draft.min.trim();
    const max = draft.max.trim();
    if (min === '' && max === '') continue;
    if (min === '' || max === '') return { ok: false, locationId, message: 'Enter both a minimum and a maximum.' };
    const minNumber = WHOLE.test(min) ? Number(min) : Number.NaN;
    const maxNumber = WHOLE.test(max) ? Number(max) : Number.NaN;
    const problem = validateTarget(minNumber, maxNumber);
    if (problem) return { ok: false, locationId, message: problem };
    targets = { ...targets, [locationId]: { min: minNumber, max: maxNumber } };
  }
  return { ok: true, targets };
};

export const sameTargets = (a: Targets, b: Targets): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k]?.min === b[k]?.min && a[k]?.max === b[k]?.max);
};
