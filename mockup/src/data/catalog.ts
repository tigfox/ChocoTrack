import type { Collection, Location, StockMap, Variant } from '../domain/types';

export const LOCATIONS: readonly Location[] = [
  { id: 'loc-main', name: 'Main Warehouse' },
  { id: 'loc-shop', name: 'Retail Shop' },
  { id: 'loc-popup', name: 'Pop-up Kiosk' },
];

export const COLLECTIONS: readonly Collection[] = [
  { id: 'c-mini', title: 'Mini bars (not sold individually)' },
  { id: 'c-dark', title: 'Dark chocolate' },
  { id: 'c-milk', title: 'Milk chocolate' },
];

export const DEFAULT_COLLECTION_ID = 'c-mini';

// [name, extra collections, main, shop, popup]  (null = not stocked at that location)
type Row = readonly [string, readonly string[], number, number | null, number | null];

const MINI_ROWS: readonly Row[] = [
  ['100% Cacao', ['c-dark'], 90, 20, null],
  ["Surfer's Dark Seas", ['c-dark'], 130, 30, 12],
  ['Bolivia 72%', ['c-dark'], 240, 60, 30],
  ['Chuncho 72%', ['c-dark'], 150, 35, null],
  ['Chuao 72%', ['c-dark'], 120, 28, 10],
  ['Haiti 72%', ['c-dark'], 110, 22, null],
  ['Puerto Rico 72%', ['c-dark'], 100, 20, 8],
  ['Thailand 72%', ['c-dark'], 95, 18, null],
  ['Uganda 72%', ['c-dark'], 85, null, null],
  ['Tanzania 72%', ['c-dark'], 105, 24, 9],
  ['Zorzal 72%', ['c-dark'], 70, 12, null],
  ['Double Bean Double Buzz', [], 160, 40, 20],
  ['Hawaiian Salt 70%', ['c-dark'], 200, 50, 25],
  ['Cherry Blossom Dark', ['c-dark'], 75, 14, 6],
  ['Raspberry Vanilla Tea 65%', ['c-dark'], 60, 10, null],
  ['El Camino - Olive Oil Dark Chocolate', ['c-dark'], 55, 9, 4],
  ['Rum Caramel', [], 180, 38, 18],
  ['Peach IPA (Mountain Peach & Hops)', [], 65, 11, null],
  ['Desert Flower', [], 14, 4, null],
  ['Coconut Milk Chocolate 55%', ['c-milk'], 170, 36, 15],
  ['Organic Milk Chocolate', ['c-milk'], 310, 80, 45],
  ['Salted Caramel Milk Chocolate', ['c-milk'], 260, 70, 35],
  ['Smoked Salt Milk Chocolate', ['c-milk'], 140, 30, null],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const miniVariants: readonly Variant[] = MINI_ROWS.map(([name, extra], i) => ({
  id: `v-mini-${slug(name)}`,
  title: `Mini - ${name}`,
  sku: `MINI-${slug(name).toUpperCase()}`,
  barcode: `8500100${String(i + 1).padStart(5, '0')}`,
  collectionIds: ['c-mini', ...extra],
}));

export const KIT_6: Variant = {
  id: 'v-kit-smp-6',
  title: 'Sampler Kit - 6 Pack',
  sku: 'SMP-6',
  barcode: '8500300000006',
  collectionIds: [],
  kitSize: 6,
};

export const KIT_12: Variant = {
  id: 'v-kit-smp-12',
  title: 'Sampler Kit - 12 Pack',
  sku: 'SMP-12',
  barcode: '8500300000012',
  collectionIds: [],
  kitSize: 12,
};

export const INITIAL_VARIANTS: readonly Variant[] = [...miniVariants, KIT_6, KIT_12];

const locationIds = LOCATIONS.map((l) => l.id);

const stockLine = (quantities: readonly (number | null)[]): Readonly<Record<string, number>> =>
  Object.fromEntries(
    quantities.flatMap((q, i) => (q === null ? [] : [[locationIds[i] as string, q] as const])),
  );

export const initialStock = (): StockMap => ({
  ...Object.fromEntries(MINI_ROWS.map(([, , ...q], i) => [(miniVariants[i] as Variant).id, stockLine(q)])),
  [KIT_6.id]: stockLine([12, 0, null]),
  [KIT_12.id]: stockLine([5, null, null]),
});

export const indexById = (variants: readonly Variant[]): Readonly<Record<string, Variant>> =>
  Object.fromEntries(variants.map((v) => [v.id, v]));
