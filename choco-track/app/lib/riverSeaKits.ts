import { KIT_SIZE_METAFIELD, KIT_TAG } from '../shopify/catalog';
import type { ExportProduct, ExportVariant } from './riverSeaExport';
import { guessKitSize } from './guessKitSize';

export { KIT_TAG, KIT_SIZE_METAFIELD };

/** River Sea products that are sold as boxes of mini bars (the dev store marks them as kits). */
const KIT_HANDLES: ReadonlySet<string> = new Set([
  'mini-sampler-box',
  'single-origin-select-box',
  '6-bar-mini-holiday-flavor-gift-set',
  'mini-bar-5-pack',
  'mini-packs',
  'mini-bars-assorted',
]);

/**
 * The kit size for an imported variant, or undefined when it is not a kit: a known kit product,
 * tracked (assembling adds stock to it), and a size in the variant or product name.
 */
export const kitSizeFor = (product: Pick<ExportProduct, 'handle' | 'title'>, variant: ExportVariant): number | undefined => {
  if (!KIT_HANDLES.has(product.handle) || !variant.tracked) return undefined;
  return guessKitSize(variant.optionValues.join(' ')) ?? guessKitSize(product.title);
};
