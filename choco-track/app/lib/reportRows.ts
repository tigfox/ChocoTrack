import { cellView, hasTargets, type CellView, type LevelMap, type PendingMap } from '../domain/tracking';
import type { ReportProduct, ReportVariant } from '../shopify/trackedCatalog';

export interface RowFilters {
  readonly search: string;
  readonly lowOnly: boolean;
  /** Include variants of flagged products that have no targets yet. */
  readonly showUntargeted: boolean;
}

export interface ReportRow {
  readonly variant: ReportVariant;
  /** The variant's own name, empty for single-variant products. */
  readonly label: string;
  /** locationId -> cell, for the visible locations only. */
  readonly cells: Readonly<Record<string, CellView>>;
}

export interface ReportGroup {
  readonly productId: string;
  readonly productTitle: string;
  readonly imageUrl?: string;
  readonly truncated: boolean;
  readonly rows: readonly ReportRow[];
}

export interface ReportRows {
  readonly groups: readonly ReportGroup[];
  readonly rowCount: number;
  /** Variants left out because they have no targets (shown with the "without targets" switch). */
  readonly hiddenUntargeted: number;
}

const DEFAULT_TITLE = 'Default Title';

/** "Rum Caramel - Mini", or just the product name for a single-variant product. */
export const variantLabel = (v: { readonly productTitle: string; readonly title: string }): string =>
  v.title === DEFAULT_TITLE ? v.productTitle : `${v.productTitle} - ${v.title}`;

const matchesSearch = (variant: ReportVariant, search: string): boolean => {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${variant.productTitle} ${variant.title} ${variant.sku}`.toLowerCase();
  return words.every((w) => haystack.includes(w));
};

export const buildReportGroups = (input: {
  readonly products: readonly ReportProduct[];
  readonly levels: LevelMap;
  readonly pending: PendingMap;
  readonly locationIds: readonly string[];
  readonly filters: RowFilters;
}): ReportRows => {
  const { products, levels, pending, locationIds, filters } = input;
  const toRow = (variant: ReportVariant): ReportRow => ({
    variant,
    label: variant.title === DEFAULT_TITLE ? '' : variant.title,
    cells: Object.fromEntries(
      locationIds.map((id) => [id, cellView(variant.targets[id], levels[variant.id]?.[id], pending[variant.id]?.[id] ?? 0)]),
    ),
  });
  const keep = (row: ReportRow): boolean =>
    (filters.showUntargeted || hasTargets(row.variant)) &&
    matchesSearch(row.variant, filters.search) &&
    (!filters.lowOnly || Object.values(row.cells).some((c) => c.status === 'low'));
  const groups = products
    .map((p): ReportGroup => ({
      productId: p.id,
      productTitle: p.title,
      ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
      truncated: p.truncated,
      rows: p.variants.map(toRow).filter(keep),
    }))
    .filter((g) => g.rows.length > 0);
  return {
    groups,
    rowCount: groups.reduce((n, g) => n + g.rows.length, 0),
    hiddenUntargeted: products.flatMap((p) => p.variants).filter((v) => !hasTargets(v)).length,
  };
};

/** The first `limit` rows, keeping whole groups together and dropping groups that end up empty. */
export const limitGroups = (groups: readonly ReportGroup[], limit: number): readonly ReportGroup[] =>
  groups.reduce<{ readonly left: number; readonly kept: readonly ReportGroup[] }>(
    (acc, g) => (acc.left <= 0 ? acc : { left: acc.left - g.rows.length, kept: [...acc.kept, { ...g, rows: g.rows.slice(0, acc.left) }] }),
    { left: limit, kept: [] },
  ).kept;
