import type { StockLocation } from './riverSeaStock';

/** Live-store location names -> dev-store location names. */
const LOCATION_MAP: Readonly<Record<string, StockLocation>> = {
  'River-Sea Chocolates Reston': 'Factory',
  'River-Sea Chocolates Chantilly': 'Cafe',
  'Union Market': 'Market Store',
  'Myterra Warehouse': 'Warehouse',
};
export type ActualStock = Readonly<Partial<Record<StockLocation, number>>>;

export const actualStockKey = (handle: string, optionValues: readonly string[]): string => [handle, ...optionValues].join('\u0000');

/**
 * Real on-hand counts from an inventory export, keyed by handle + option values.
 * "not stocked" and "not fulfilled" rows are skipped, and negative counts become 0 (dev stock cannot go below zero).
 */
export const parseInventory = (records: readonly Readonly<Record<string, string>>[]): ReadonlyMap<string, ActualStock> =>
  records.reduce<ReadonlyMap<string, ActualStock>>((acc, r) => {
    const count = Number(r['On hand (current)']);
    if (!Number.isInteger(count)) return acc;
    const location = LOCATION_MAP[r.Location ?? ''];
    if (!location) throw new Error(`Unknown inventory location "${r.Location}"`);
    const values = [r['Option1 Value'], r['Option2 Value'], r['Option3 Value']].filter((v): v is string => !!v);
    const key = actualStockKey(r.Handle ?? '', values);
    return new Map([...acc, [key, { ...acc.get(key), [location]: Math.max(0, count) }]]);
  }, new Map());
