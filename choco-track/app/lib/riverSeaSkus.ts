import { parseCsv } from './csvParse';
import type { ExportProduct } from './riverSeaExport';

export type SkuEntry = { readonly category: string; readonly flavor: string; readonly sku: string };

/** Reads "Mini SKUs.csv": a category row (name in column 1) followed by flavor rows (flavor in column 2, SKU in column 4). */
export const parseSkuCsv = (text: string): readonly SkuEntry[] => {
  const [, ...body] = parseCsv(text);
  const { entries } = body.reduce<{ category: string; entries: readonly SkuEntry[] }>(
    (acc, r) => {
      if ((r[0] ?? '').trim() !== '') return { ...acc, category: (r[0] as string).trim() };
      const flavor = (r[1] ?? '').trim();
      const sku = (r[3] ?? '').trim();
      return flavor && sku ? { ...acc, entries: [...acc.entries, { category: acc.category, flavor, sku }] } : acc;
    },
    { category: '', entries: [] },
  );
  const dup = entries.find((e, i) => entries.findIndex((o) => o.sku === e.sku) !== i);
  if (dup) throw new Error(`Duplicate SKU ${dup.sku}`);
  return entries;
};

/** New products with each SKU set on the variant whose first option value is the flavor, under the category's product handle. */
export const applySkus = (
  products: readonly ExportProduct[],
  entries: readonly SkuEntry[],
  handleByCategory: Readonly<Record<string, string>>,
): readonly ExportProduct[] => {
  const targets = entries.map((e) => {
    const handle = handleByCategory[e.category];
    if (!handle) throw new Error(`No product handle for category ${e.category}`);
    const exists = products.some((p) => p.handle === handle && p.variants.some((v) => v.optionValues[0] === e.flavor));
    if (!exists) throw new Error(`No variant for ${e.category} / ${e.flavor} (${handle})`);
    return { handle, ...e };
  });
  return products.map((p) => ({
    ...p,
    variants: p.variants.map((v) => {
      const hit = targets.find((t) => t.handle === p.handle && t.flavor === v.optionValues[0]);
      return hit ? { ...v, sku: hit.sku } : v;
    }),
  }));
};
