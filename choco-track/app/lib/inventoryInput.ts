import { MAX_PACK_GROUPS, MAX_PACK_VARIANTS, validatePackSize, type PackGroup, type PackSizes } from '../domain/packSizes';
import { SETUP_ACTIONS, type SetupAction } from '../domain/setup';
import { setTarget, validateTarget, type Targets } from '../domain/targets';
import { isLocationGid, isProductGid, isVariantGid } from './shopifyIds';

export type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

const INVALID = 'Invalid request.';
const MAX_LOCATIONS = 50;
const MAX_SOURCES = 20;
const MAX_DIGEST = 200;
const MIN_KEY = 8;
const MAX_KEY = 64;

const fail = (error: string = INVALID): Parsed<never> => ({ ok: false, error });
const record = (raw: unknown): Record<string, unknown> | undefined =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined;

export interface FlagInput {
  readonly productId: string;
  readonly tracked: boolean;
}

export const parseFlagInput = (raw: unknown): Parsed<FlagInput> => {
  const body = record(raw);
  if (!body || !isProductGid(body.productId) || typeof body.tracked !== 'boolean') return fail();
  return { ok: true, value: { productId: body.productId, tracked: body.tracked } };
};

export interface TargetsInput {
  readonly variantId: string;
  /** The complete set of targets the variant should end up with. */
  readonly targets: Targets;
  readonly digest: string | null;
}

/** Each location's entry is `{min, max}` or null (no target there). Numbers are checked by the same rules as the UI. */
export const parseTargetsInput = (raw: unknown): Parsed<TargetsInput> => {
  const body = record(raw);
  const targets = record(body?.targets);
  if (!body || !targets || !isVariantGid(body.variantId)) return fail();
  const digest = body.digest;
  if (digest !== null && (typeof digest !== 'string' || digest.length > MAX_DIGEST)) return fail();
  const entries = Object.entries(targets);
  if (entries.length > MAX_LOCATIONS) return fail();
  let result: Targets = {};
  for (const [locationId, value] of entries) {
    if (!isLocationGid(locationId)) return fail();
    if (value === null) continue;
    const t = record(value);
    if (!t || typeof t.min !== 'number' || typeof t.max !== 'number') return fail();
    const problem = validateTarget(t.min, t.max);
    if (problem) return fail(problem);
    result = setTarget(result, locationId, { min: t.min, max: t.max });
  }
  return { ok: true, value: { variantId: body.variantId, targets: result, digest } };
};

export interface UntrackedInput {
  readonly variantId: string;
  readonly untracked: boolean;
}

/** Switch one variant off or back on for the report. */
export const parseUntrackedInput = (raw: unknown): Parsed<UntrackedInput> => {
  const body = record(raw);
  if (!body || !isVariantGid(body.variantId) || typeof body.untracked !== 'boolean') return fail();
  return { ok: true, value: { variantId: body.variantId, untracked: body.untracked } };
};

export interface SetupInput {
  readonly action: SetupAction;
}

/** A press of one of the setup guide's buttons. */
export const parseSetupInput = (raw: unknown): Parsed<SetupInput> => {
  const action = record(raw)?.action;
  const known = SETUP_ACTIONS.find((a) => a === action);
  return known ? { ok: true, value: { action: known } } : fail();
};

/** Resetting clears settings for the whole store, so the request must say so explicitly. */
export const parseResetInput = (raw: unknown): Parsed<Record<string, never>> =>
  record(raw)?.confirm === true ? { ok: true, value: {} } : fail();

export const parseSourcesInput = (raw: unknown): Parsed<{ sourceIds: readonly string[] }> => {
  const ids = record(raw)?.sourceIds;
  if (!Array.isArray(ids) || ids.length > MAX_SOURCES || !ids.every(isLocationGid) || new Set(ids).size !== ids.length) return fail();
  return { ok: true, value: { sourceIds: ids } };
};

/** The default pack size plus groups of variants that ship in other sizes. A variant may be in only one group. */
export const parsePackSizesInput = (raw: unknown): Parsed<{ packSizes: PackSizes }> => {
  const body = record(raw);
  if (!body || typeof body.defaultSize !== 'number' || !Array.isArray(body.groups) || body.groups.length > MAX_PACK_GROUPS) return fail();
  const problem = validatePackSize(body.defaultSize);
  if (problem) return fail(problem);
  const seen = new Set<string>();
  let groups: PackGroup[] = [];
  for (const item of body.groups) {
    const group = record(item);
    if (!group || typeof group.size !== 'number' || !Array.isArray(group.variantIds)) return fail();
    const bad = validatePackSize(group.size);
    if (bad) return fail(bad);
    if (!group.variantIds.every(isVariantGid)) return fail();
    for (const id of group.variantIds as string[]) {
      if (seen.has(id)) return fail('A variant can be in only one pack size group.');
      seen.add(id);
    }
    groups = [...groups, { size: group.size, variantIds: group.variantIds as string[] }];
  }
  if (seen.size > MAX_PACK_VARIANTS) return fail();
  return { ok: true, value: { packSizes: { defaultSize: body.defaultSize, groups } } };
};

export interface TransferInput {
  /** One click, one key: a retry cannot create the same drafts twice. */
  readonly key: string;
  /** Both or neither: limits the request to one suggested route. */
  readonly originId?: string;
  readonly destinationId?: string;
}

export const parseTransferInput = (raw: unknown): Parsed<TransferInput> => {
  const body = record(raw);
  if (!body || typeof body.key !== 'string' || body.key.length < MIN_KEY || body.key.length > MAX_KEY) return fail();
  const { originId, destinationId } = body;
  if (originId === undefined && destinationId === undefined) return { ok: true, value: { key: body.key } };
  if (!isLocationGid(originId) || !isLocationGid(destinationId)) return fail();
  return { ok: true, value: { key: body.key, originId, destinationId } };
};
