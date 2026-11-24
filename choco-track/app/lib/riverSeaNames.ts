import { flavorDisplayName, isFlavorSlug } from './flavorName';
import { MINI_CATEGORIES } from './riverSeaCollections';
import type { ExportProduct, ExportVariant } from './riverSeaExport';

const MINI_CATEGORY_HANDLES: ReadonlySet<string> = new Set(MINI_CATEGORIES.map((c) => c.handle));

/** Titles of the ordinary (non-mini) products: the names a mini flavor is matched against. */
export const nonMiniTitles = (products: readonly Pick<ExportProduct, 'handle' | 'title'>[]): readonly string[] =>
  products.filter((p) => !p.handle.startsWith('mini')).map((p) => p.title);

/** The display name for a flavor variant of a mini category product, or undefined when it is not a hyphenated flavor. */
export const miniDisplayName = (
  product: Pick<ExportProduct, 'handle'>,
  variant: ExportVariant,
  titles: readonly string[],
): string | undefined => {
  const flavor = variant.optionValues[0] ?? '';
  return MINI_CATEGORY_HANDLES.has(product.handle) && isFlavorSlug(flavor) ? flavorDisplayName(flavor, titles) : undefined;
};
