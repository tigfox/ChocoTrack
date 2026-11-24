import type { ExportProduct, ExportVariant } from './riverSeaExport';
import { DISPLAY_NAME_METAFIELD } from '../shopify/catalog';
import { KIT_SIZE_METAFIELD, KIT_TAG } from './riverSeaKits';
import type { StockLine } from './riverSeaStock';

export type ProductSetContext = {
  /** Export category text -> Shopify taxonomy category GID. */
  readonly categoryIds: Readonly<Record<string, string>>;
  readonly stockFor: (product: ExportProduct, variant: ExportVariant) => readonly StockLine[];
  /** Size of the kit this variant should be marked as, if any (tags the product and sets the variant metafield). */
  /** A name to show for this variant, stored in its choco_track.display_name metafield. */
  readonly displayNameFor?: (product: ExportProduct, variant: ExportVariant) => string | undefined;
  readonly kitSizeFor?: (product: ExportProduct, variant: ExportVariant) => number | undefined;
};
export type ProductSetInput = Record<string, unknown> & { readonly variants: readonly Record<string, unknown>[] };

const GRAMS_PER_POUND = 453.59237;
const unique = <T>(list: readonly T[]): readonly T[] => [...new Set(list)];

const buildVariant = (product: ExportProduct, v: ExportVariant, ctx: ProductSetContext): Record<string, unknown> => {
  const stock = ctx.stockFor(product, v);
  const kitSize = ctx.kitSizeFor?.(product, v);
  const displayName = ctx.displayNameFor?.(product, v);
  const metafields = [
    ...(kitSize !== undefined ? [{ ...KIT_SIZE_METAFIELD, type: 'number_integer', value: String(kitSize) }] : []),
    ...(displayName !== undefined ? [{ ...DISPLAY_NAME_METAFIELD, type: 'single_line_text_field', value: displayName }] : []),
  ];
  return {
    optionValues: product.optionNames.map((optionName, i) => ({ optionName, name: v.optionValues[i] ?? '' })),
    sku: v.sku,
    price: v.price,
    inventoryPolicy: v.policy,
    taxable: v.taxable,
    ...(v.compareAt !== '' ? { compareAtPrice: v.compareAt } : {}),
    ...(v.barcodes.length > 0 ? { barcodes: v.barcodes } : {}),
    ...(v.image !== '' ? { file: { originalSource: v.image, contentType: 'IMAGE' } } : {}),
    inventoryItem: {
      tracked: v.tracked || stock.length > 0,
      requiresShipping: v.requiresShipping,
      ...(v.cost !== '' ? { cost: v.cost } : {}),
      ...(v.grams !== null ? { measurement: { weight: { value: Number((v.grams / GRAMS_PER_POUND).toFixed(6)), unit: 'POUNDS' } } } : {}),
    },
    ...(stock.length > 0 ? { inventoryQuantities: stock } : {}),
    ...(metafields.length > 0 ? { metafields } : {}),
  };
};

/** The Admin API productSet input that recreates one export product. Product and variant images are listed once each. */
export const buildProductSetInput = (product: ExportProduct, ctx: ProductSetContext): ProductSetInput => {
  const category = product.category === '' ? undefined : ctx.categoryIds[product.category];
  if (product.category !== '' && !category) throw new Error(`No taxonomy category for "${product.category}" (${product.handle})`);
  const sources = unique([
    ...[...product.images].sort((a, b) => a.position - b.position).map((i) => i.src),
    ...product.variants.map((v) => v.image).filter(Boolean),
  ]);
  const hasKit = product.variants.some((v) => ctx.kitSizeFor?.(product, v) !== undefined);
  const altBySrc = new Map(product.images.map((i) => [i.src, i.alt]));
  return {
    handle: product.handle,
    title: product.title,
    descriptionHtml: product.bodyHtml,
    vendor: product.vendor,
    productType: product.type,
    tags: hasKit ? [...new Set([...product.tags, KIT_TAG])] : product.tags,
    status: product.status,
    ...(category ? { category } : {}),
    ...(product.giftCard ? { giftCard: true } : {}),
    ...(product.seo.title !== '' || product.seo.description !== '' ? { seo: product.seo } : {}),
    ...(product.metafields.length > 0 ? { metafields: product.metafields } : {}),
    ...(sources.length > 0 ? { files: sources.map((src) => ({ originalSource: src, alt: altBySrc.get(src) ?? '', contentType: 'IMAGE' })) } : {}),
    productOptions: product.optionNames.map((name, i) => ({
      name,
      position: i + 1,
      values: unique(product.variants.map((v) => v.optionValues[i] ?? '')).map((n) => ({ name: n })),
    })),
    variants: product.variants.map((v) => buildVariant(product, v, ctx)),
  };
};
