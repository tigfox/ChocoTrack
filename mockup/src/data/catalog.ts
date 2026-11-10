import type { Collection, Location, StockMap, Variant } from '../domain/types';
import flavors from './flavors.json';

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
export const DEFAULT_KIT_ID = 'v-kit-smp-6';

interface FlavorRow {
  readonly name: string;
  readonly collections: readonly string[];
  /** Available per location, in LOCATIONS order; null = not stocked there. */
  readonly stock: readonly (number | null)[];
}

const MINI_ROWS: readonly FlavorRow[] = flavors;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const miniVariants: readonly Variant[] = MINI_ROWS.map(({ name, collections }, i) => ({
  id: `v-mini-${slug(name)}`,
  title: `Mini - ${name}`,
  sku: `MINI-${slug(name).toUpperCase()}`,
  barcode: `8500100${String(i + 1).padStart(5, '0')}`,
  collectionIds: ['c-mini', ...collections],
  imageUrl: `/images/mini/${slug(name)}.svg`,
}));

export const KIT_4: Variant = {
  id: 'v-kit-smp-4',
  title: 'Sampler Kit - 4 Pack',
  sku: 'SMP-4',
  barcode: '8500300000004',
  collectionIds: [],
  kitSize: 4,
};

export const KIT_5: Variant = {
  id: 'v-kit-smp-5',
  title: 'Sampler Kit - 5 Pack',
  sku: 'SMP-5',
  barcode: '8500300000005',
  collectionIds: [],
  kitSize: 5,
};

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

export const INITIAL_VARIANTS: readonly Variant[] = [...miniVariants, KIT_4, KIT_5, KIT_6, KIT_12];

const locationIds = LOCATIONS.map((l) => l.id);

const stockLine = (quantities: readonly (number | null)[]): Readonly<Record<string, number>> =>
  Object.fromEntries(
    quantities.flatMap((q, i) => (q === null ? [] : [[locationIds[i] as string, q] as const])),
  );

export const initialStock = (): StockMap => ({
  ...Object.fromEntries(MINI_ROWS.map(({ stock }, i) => [(miniVariants[i] as Variant).id, stockLine(stock)])),
  [KIT_4.id]: stockLine([8, 3, null]),
  [KIT_5.id]: stockLine([6, 2, null]),
  [KIT_6.id]: stockLine([12, 0, null]),
  [KIT_12.id]: stockLine([5, null, null]),
});

export const indexById = (variants: readonly Variant[]): Readonly<Record<string, Variant>> =>
  Object.fromEntries(variants.map((v) => [v.id, v]));
