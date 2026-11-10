import type { StockMap, UnitCounts } from '../domain/types';

export interface SubmitInput {
  readonly mode: 'assemble' | 'disassemble';
  readonly kitId: string;
  readonly kitCount: number;
  readonly locationId: string;
  readonly perKit: UnitCounts;
  /** Stock the user saw: used only as the compare-and-swap guard, never trusted for ids. */
  readonly seenStock: StockMap;
  readonly runId: string;
}

export type ParseResult = { readonly ok: true; readonly value: SubmitInput } | { readonly ok: false; readonly error: string };

const MAX_KITS = 10_000;
const MAX_PER_KIT = 100;
/** A kit holds at most 12 bars, so a mix has at most 12 distinct flavors; allow headroom for invalid input to be reported. */
const MAX_MIX_VARIANTS = 50;
const MAX_STOCK_VARIANTS = MAX_MIX_VARIANTS + 1;
const GID = /^gid:\/\/shopify\/[A-Za-z]+\/\d+$/;
const RUN_ID = /^[A-Za-z0-9-]{8,64}$/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isGid = (v: unknown, type: string): v is string => typeof v === 'string' && GID.test(v) && v.includes(`/${type}/`);
const isCount = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

const fail = (error: string): ParseResult => ({ ok: false, error });

const parsePerKit = (raw: unknown): UnitCounts | undefined => {
  if (!isRecord(raw)) return undefined;
  const entries = Object.entries(raw);
  if (entries.length === 0 || entries.length > MAX_MIX_VARIANTS) return undefined;
  return entries.every(([id, n]) => isGid(id, 'ProductVariant') && isCount(n, 1, MAX_PER_KIT))
    ? (raw as UnitCounts)
    : undefined;
};

const parseSeenStock = (raw: unknown): StockMap | undefined => {
  if (!isRecord(raw)) return undefined;
  const variants = Object.entries(raw);
  if (variants.length > MAX_STOCK_VARIANTS) return undefined;
  const valid = variants.every(
    ([id, levels]) =>
      isGid(id, 'ProductVariant') &&
      isRecord(levels) &&
      Object.entries(levels).every(([loc, qty]) => isGid(loc, 'Location') && isCount(qty, 0, 1_000_000_000)),
  );
  return valid ? (raw as StockMap) : undefined;
};

/** Validates the untrusted JSON posted by the browser. */
export const parseSubmitInput = (raw: unknown): ParseResult => {
  if (!isRecord(raw)) return fail('Invalid request.');
  const { mode, kitId, kitCount, locationId, perKit, seenStock, runId } = raw;
  if (mode !== 'assemble' && mode !== 'disassemble') return fail('Unknown action.');
  if (!isGid(kitId, 'ProductVariant')) return fail('Choose a kit.');
  if (!isGid(locationId, 'Location')) return fail('Choose a location.');
  if (!isCount(kitCount, 1, MAX_KITS)) return fail('Enter a whole number of kits.');
  if (typeof runId !== 'string' || !RUN_ID.test(runId)) return fail('Invalid request id.');
  const mix = parsePerKit(perKit);
  if (!mix) return fail('Choose the mini bars for the kit.');
  const stock = parseSeenStock(seenStock);
  if (!stock) return fail('Invalid stock snapshot.');
  return { ok: true, value: { mode, kitId, kitCount, locationId, perKit: mix, seenStock: stock, runId } };
};
