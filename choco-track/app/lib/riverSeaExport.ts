/** Reads a Shopify product export CSV (one row per variant or image) into products. */
/** A variant barcode. `gtin:` values are typed GTIN; the live store also uses SKU-like text, which has no type. */
export type Barcode = { readonly value: string; readonly type?: 'GTIN' };
export type ExportVariant = {
  readonly optionValues: readonly string[];
  readonly sku: string;
  readonly barcodes: readonly Barcode[];
  readonly grams: number | null;
  readonly tracked: boolean;
  readonly policy: 'DENY' | 'CONTINUE';
  readonly requiresShipping: boolean;
  readonly taxable: boolean;
  readonly price: string;
  readonly compareAt: string;
  readonly cost: string;
  readonly image: string;
};
export type ExportImage = { readonly src: string; readonly alt: string; readonly position: number };
export type ExportMetafield = { readonly namespace: string; readonly key: string; readonly type: string; readonly value: string };
export type ExportProduct = {
  readonly handle: string;
  readonly title: string;
  readonly bodyHtml: string;
  readonly vendor: string;
  readonly category: string;
  readonly type: string;
  readonly tags: readonly string[];
  readonly published: boolean;
  readonly status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  readonly giftCard: boolean;
  readonly optionNames: readonly string[];
  readonly seo: { readonly title: string; readonly description: string };
  readonly metafields: readonly ExportMetafield[];
  readonly images: readonly ExportImage[];
  readonly variants: readonly ExportVariant[];
};
type Row = Readonly<Record<string, string>>;

/** Export metafield columns the dev store can take as plain values. The rest are reference lists or app-owned. */
const METAFIELD_COLUMNS: readonly { column: string; namespace: string; key: string; type: string }[] = [
  { column: 'Cacao % (product.metafields.custom.cacao)', namespace: 'custom', key: 'cacao', type: 'number_integer' },
  { column: 'Tasting Notes (product.metafields.custom.tasting_notes)', namespace: 'custom', key: 'tasting_notes', type: 'multi_line_text_field' },
];

const parseBarcode = (raw: string): Barcode => {
  if (!/^gtin:/i.test(raw)) return { value: raw };
  const value = raw.replace(/^gtin:/i, '');
  if (!/^\d{8,14}$/.test(value)) throw new Error(`Unsupported barcode "${raw}"`);
  return { value, type: 'GTIN' };
};

/** The export's "Variant Barcodes" cell: values separated by ";", each optionally prefixed "gtin:". */
export const parseBarcodes = (raw: string): readonly Barcode[] =>
  raw.split(';').map((b) => b.trim()).filter(Boolean).map(parseBarcode);

const STATUSES = ['ACTIVE', 'DRAFT', 'ARCHIVED'] as const;
const toStatus = (raw: string): ExportProduct['status'] => {
  const s = raw.trim().toUpperCase();
  const found = STATUSES.find((x) => x === s);
  if (!found) throw new Error(`Unknown product status "${raw}"`);
  return found;
};
const bool = (raw: string | undefined): boolean => (raw ?? '').toUpperCase() === 'TRUE';
const optionNamesOf = (r: Row): readonly string[] => [r['Option1 Name'], r['Option2 Name'], r['Option3 Name']].filter((n): n is string => !!n);

const toVariant = (r: Row, optionCount: number): ExportVariant => {
  const grams = (r['Variant Grams'] ?? '').trim();
  return {
    optionValues: [r['Option1 Value'], r['Option2 Value'], r['Option3 Value']].slice(0, optionCount).map((v) => v ?? ''),
    sku: r['Variant SKU'] ?? '',
    barcodes: parseBarcodes(r['Variant Barcodes'] ?? ''),
    grams: grams === '' ? null : Number(grams),
    tracked: r['Variant Inventory Tracker'] === 'shopify',
    policy: (r['Variant Inventory Policy'] ?? '').toLowerCase() === 'continue' ? 'CONTINUE' : 'DENY',
    requiresShipping: bool(r['Variant Requires Shipping']),
    taxable: bool(r['Variant Taxable']),
    price: r['Variant Price'] ?? '',
    compareAt: r['Variant Compare At Price'] ?? '',
    cost: r['Cost per item'] ?? '',
    image: r['Variant Image'] ?? '',
  };
};

const toProduct = (rows: readonly Row[]): ExportProduct => {
  const [head] = rows as readonly [Row, ...Row[]];
  const optionNames = optionNamesOf(head);
  return {
    handle: head.Handle ?? '',
    title: head.Title ?? '',
    bodyHtml: head['Body (HTML)'] ?? '',
    vendor: head.Vendor ?? '',
    category: head['Product Category'] ?? '',
    type: head.Type ?? '',
    tags: (head.Tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    published: bool(head.Published),
    status: toStatus(head.Status ?? ''),
    giftCard: bool(head['Gift Card']),
    optionNames,
    seo: { title: head['SEO Title'] ?? '', description: head['SEO Description'] ?? '' },
    metafields: METAFIELD_COLUMNS.flatMap(({ column, ...mf }) => ((head[column] ?? '') === '' ? [] : [{ ...mf, value: head[column] as string }])),
    images: rows
      .filter((r) => (r['Image Src'] ?? '') !== '')
      .map((r) => ({ src: r['Image Src'] as string, alt: r['Image Alt Text'] ?? '', position: Number(r['Image Position'] || 0) })),
    variants: rows.filter((r) => (r['Option1 Value'] ?? '') !== '').map((r) => toVariant(r, optionNames.length)),
  };
};

/** Groups export records by handle, in file order. A product starts at the row that has a Title. */
export const groupProducts = (records: readonly Row[]): readonly ExportProduct[] => {
  const groups = records.reduce<readonly (readonly Row[])[]>((acc, r) => {
    if ((r.Title ?? '') !== '') return [...acc, [r]];
    const last = acc[acc.length - 1];
    if (!last || last[0]?.Handle !== r.Handle) return acc;
    return [...acc.slice(0, -1), [...last, r]];
  }, []);
  return groups.map(toProduct);
};
