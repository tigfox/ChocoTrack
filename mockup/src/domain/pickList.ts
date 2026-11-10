import { availableAt, positiveEntries } from './stock';
import type { StockMap, UnitCounts, Variant } from './types';

export interface PickRow {
  readonly variantId: string;
  readonly title: string;
  readonly sku: string;
  readonly barcode: string;
  readonly perKit: number;
  readonly total: number;
  /** Stock at the location; null when not stocked there. */
  readonly available: number | null;
  /** Units missing to fulfil `total` (0 when enough, or when returning stock). */
  readonly short: number;
}

export interface PickList {
  readonly mode: 'assemble' | 'disassemble';
  readonly kit: Variant | undefined;
  readonly kitCount: number;
  readonly rows: readonly PickRow[];
  readonly totalUnits: number;
}

export interface PickListInput {
  readonly mode: PickList['mode'];
  readonly stock: StockMap;
  readonly variantsById: Readonly<Record<string, Variant>>;
  readonly kit: Variant | undefined;
  readonly kitCount: number;
  readonly perKit: UnitCounts;
  readonly locationId: string;
}

/** Builds the printable pick list. Works for in-progress mixes and never changes inventory. */
export const buildPickList = (input: PickListInput): PickList => {
  const kits = Number.isInteger(input.kitCount) && input.kitCount >= 1 ? input.kitCount : 0;
  const rows = positiveEntries(input.perKit).map(([id, perKit]): PickRow => {
    const variant = input.variantsById[id];
    const total = perKit * kits;
    const available = availableAt(input.stock, id, input.locationId);
    return {
      variantId: id,
      title: variant?.title ?? id,
      sku: variant?.sku ?? '',
      barcode: variant?.barcode ?? '',
      perKit,
      total,
      available,
      short: input.mode === 'assemble' ? Math.max(0, total - (available ?? 0)) : 0,
    };
  });
  return {
    mode: input.mode,
    kit: input.kit,
    kitCount: input.kitCount,
    rows,
    totalUnits: rows.reduce((n, r) => n + r.total, 0),
  };
};
