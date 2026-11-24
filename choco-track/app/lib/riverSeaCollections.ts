import type { ExportProduct } from './riverSeaExport';

/** The mini bar categories: each is one product whose variants are the flavors. `title` is the collection (kit category) name. */
export const MINI_CATEGORIES = [
  { title: 'Limited Editions', handle: 'mini-bars-limited-editions' },
  { title: 'Dark Milks', handle: 'mini-bars-dark-milks' },
  { title: 'Rare', handle: 'mini-bars-rare' },
  { title: 'Single Origin', handle: 'mini-bars-single-origins' },
  { title: 'Dark', handle: 'mini-bars-darks' },
  { title: 'Milk', handle: 'mini-bars-milks' },
  { title: 'White Chocolate', handle: 'mini-bars-white-chocolate' },
] as const;

export const MINI_COLLECTION_TITLE = 'Mini bars';
const MINI_PRODUCT_PREFIX = 'Mini Bars - ';

/** Collections left over from the old one-product-per-bar seed data; they are empty after the import. */
export const STALE_COLLECTION_TITLES: readonly string[] = ['Mini bars (not sold individually)', 'Dark chocolate', 'Milk chocolate'];

export interface CollectionRule {
  readonly column: 'TITLE';
  readonly relation: 'CONTAINS' | 'EQUALS';
  readonly condition: string;
}
export interface CollectionSpec {
  readonly title: string;
  readonly rules: readonly CollectionRule[];
}

/**
 * Smart collections to create: "Mini bars" (every product titled "Mini Bars - ...", the picker's default)
 * and one per mini category holding that category's product, so a kit category picks its flavors.
 */
export const collectionSpecs = (products: readonly Pick<ExportProduct, 'handle' | 'title'>[]): readonly CollectionSpec[] => [
  { title: MINI_COLLECTION_TITLE, rules: [{ column: 'TITLE', relation: 'CONTAINS', condition: MINI_PRODUCT_PREFIX }] },
  ...MINI_CATEGORIES.map((c) => {
    const product = products.find((p) => p.handle === c.handle);
    if (!product) throw new Error(`Export has no product ${c.handle} for the ${c.title} collection`);
    return { title: c.title, rules: [{ column: 'TITLE', relation: 'EQUALS', condition: product.title }] satisfies readonly CollectionRule[] };
  }),
];
