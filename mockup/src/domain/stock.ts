import type { StockMap, UnitCounts } from './types';

/** Available quantity, or null when the variant is not stocked at the location. */
export const availableAt = (stock: StockMap, variantId: string, locationId: string): number | null =>
  stock[variantId]?.[locationId] ?? null;

export const sumUnits = (counts: UnitCounts): number =>
  Object.values(counts).reduce((total, n) => total + n, 0);

export const positiveEntries = (counts: UnitCounts): ReadonlyArray<readonly [string, number]> =>
  Object.entries(counts).filter(([, n]) => n > 0);

/** How many kits the chosen mix could produce from current stock at the location. */
export const maxBuildable = (stock: StockMap, perKit: UnitCounts, locationId: string): number => {
  const lines = positiveEntries(perKit);
  if (lines.length === 0) return 0;
  return Math.min(
    ...lines.map(([id, perKitQty]) => Math.floor((availableAt(stock, id, locationId) ?? 0) / perKitQty)),
  );
};
