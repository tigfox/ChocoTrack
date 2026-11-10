import { positiveEntries } from './stock';
import type { InventoryChange, StockMap, UnitCounts, Variant } from './types';

export const assemblyChanges = (a: {
  kit: Variant;
  kitCount: number;
  perKit: UnitCounts;
  locationId: string;
}): readonly InventoryChange[] => [
  ...positiveEntries(a.perKit).map(([variantId, qty]) => ({
    variantId,
    locationId: a.locationId,
    delta: -qty * a.kitCount,
  })),
  { variantId: a.kit.id, locationId: a.locationId, delta: a.kitCount },
];

export const disassemblyChanges = (a: {
  kit: Variant;
  kitCount: number;
  returned: UnitCounts;
  locationId: string;
}): readonly InventoryChange[] => [
  { variantId: a.kit.id, locationId: a.locationId, delta: -a.kitCount },
  ...positiveEntries(a.returned).map(([variantId, qty]) => ({
    variantId,
    locationId: a.locationId,
    delta: qty,
  })),
];

/** Returns a new StockMap; a variant not yet stocked at the location is activated at the delta. */
export const applyChanges = (stock: StockMap, changes: readonly InventoryChange[]): StockMap =>
  changes.reduce<StockMap>(
    (acc, { variantId, locationId, delta }) => ({
      ...acc,
      [variantId]: { ...acc[variantId], [locationId]: (acc[variantId]?.[locationId] ?? 0) + delta },
    }),
    stock,
  );
