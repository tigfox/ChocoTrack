import { MINI_CATEGORIES } from './riverSeaCollections';
import type { ExportProduct, ExportVariant } from './riverSeaExport';

/** The four dev-store locations, in the order quantities are listed. */
export const STOCK_LOCATIONS = ['Warehouse', 'Factory', 'Market Store', 'Cafe'] as const;
export type StockLocation = (typeof STOCK_LOCATIONS)[number];
type Location = StockLocation;
export type StockLine = { readonly locationId: string; readonly name: 'available'; readonly quantity: number };

const MINI_HANDLES: ReadonlySet<string> = new Set(MINI_CATEGORIES.map((c) => c.handle));
const FULL_BAR_STOCK: Readonly<Record<Location, number>> = { Warehouse: 1500, Factory: 500, 'Market Store': 50, Cafe: 50 };
const MINI_STOCK = 1500;
const RANDOM_MIN = 10;
const RANDOM_MAX = 50;

const line = (ids: Readonly<Record<string, string>>, location: Location, quantity: number): StockLine => {
  const locationId = ids[location];
  if (!locationId) throw new Error(`Missing location: ${location}`);
  return { locationId, name: 'available', quantity };
};

/**
 * Starting stock for one variant. Real counts (from the inventory export) win. Otherwise: 60g bars 1500/500/50/50, minis 1500 at the Factory,
 * everything else a random 10-50 at each location. Minis are stocked (and so tracked) even if the export has them untracked; other untracked variants get none.
 */
export const planStock = (
  product: Pick<ExportProduct, 'handle'>,
  variant: ExportVariant,
  locationIds: Readonly<Record<string, string>>,
  random: () => number,
  actual?: Readonly<Partial<Record<Location, number>>>,
): readonly StockLine[] => {
  if (MINI_HANDLES.has(product.handle)) return [line(locationIds, 'Factory', MINI_STOCK)];
  if (!variant.tracked) return [];
  if (actual && Object.keys(actual).length > 0)
    return STOCK_LOCATIONS.flatMap((l) => (actual[l] === undefined ? [] : [line(locationIds, l, actual[l] as number)]));
  if (variant.optionValues.some((v) => v.trim().toLowerCase() === '60g bar'))
    return STOCK_LOCATIONS.map((l) => line(locationIds, l, FULL_BAR_STOCK[l]));
  return STOCK_LOCATIONS.map((l) => line(locationIds, l, RANDOM_MIN + Math.floor(random() * (RANDOM_MAX - RANDOM_MIN + 1))));
};
