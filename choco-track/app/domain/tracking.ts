import type { Target, Targets } from './targets';

/** A variant on the Inventory report. It is tracked because it has a target at one or more locations. */
export interface TrackedVariant {
  readonly id: string;
  readonly productId: string;
  readonly productTitle: string;
  /** The variant's own name (for example "Mini"); "Default Title" for single-variant products. */
  readonly title: string;
  readonly sku: string;
  readonly imageUrl?: string;
  readonly targets: Targets;
}

export interface LevelCounts {
  readonly available: number;
  /** Stock on its way (transfers marked ready, purchase orders). */
  readonly incoming: number;
}

/** variantId -> locationId -> counts. A missing location means "not stocked there". */
export type LevelMap = Readonly<Record<string, Readonly<Record<string, LevelCounts>>>>;

/** variantId -> destination locationId -> quantity in draft transfers the app created. */
export type PendingMap = Readonly<Record<string, Readonly<Record<string, number>>>>;

export type CellStatus = 'untracked' | 'low' | 'ok' | 'over';

export interface CellView {
  readonly status: CellStatus;
  readonly available: number;
  readonly incoming: number;
  readonly pending: number;
  readonly min?: number;
  readonly max?: number;
  /** Whether Shopify has a level for this item here at all. */
  readonly stocked: boolean;
  /** Low now, but incoming plus pending stock reach the minimum. */
  readonly covered: boolean;
}

/** One table cell: a variant at a location. Low means available is below the minimum. */
export const cellView = (target: Target | undefined, level: LevelCounts | undefined, pending = 0): CellView => {
  const available = level?.available ?? 0;
  const incoming = level?.incoming ?? 0;
  const base = { available, incoming, pending, stocked: level !== undefined };
  if (!target) return { ...base, status: 'untracked', covered: false };
  const status: CellStatus = available < target.min ? 'low' : available > target.max ? 'over' : 'ok';
  return {
    ...base,
    status,
    min: target.min,
    max: target.max,
    covered: status === 'low' && available + incoming + pending >= target.min,
  };
};

export interface LowSummary {
  /** Variants with at least one low location. */
  readonly variants: number;
  /** Low variant-location cells. */
  readonly cells: number;
  /** Variants with a low location that no incoming or pending stock covers yet. */
  readonly uncoveredVariants: number;
}

export const lowSummary = (variants: readonly TrackedVariant[], levels: LevelMap, pending: PendingMap): LowSummary => {
  const lowCells = variants.map((v) =>
    Object.entries(v.targets)
      .map(([locationId, target]) => cellView(target, levels[v.id]?.[locationId], pending[v.id]?.[locationId] ?? 0))
      .filter((cell) => cell.status === 'low'),
  );
  return {
    variants: lowCells.filter((cells) => cells.length > 0).length,
    cells: lowCells.reduce((total, cells) => total + cells.length, 0),
    uncoveredVariants: lowCells.filter((cells) => cells.some((c) => !c.covered)).length,
  };
};

export interface FlaggedProduct {
  readonly id: string;
  readonly title: string;
  readonly variants: ReadonlyArray<{ readonly targets: Targets }>;
}

/** Flagged products where no variant has a target yet, so the report can say why they show nothing. */
export const productsWithoutTargets = (products: readonly FlaggedProduct[]): ReadonlyArray<{ id: string; title: string }> =>
  products
    .filter((p) => !p.variants.some((v) => Object.keys(v.targets).length > 0))
    .map(({ id, title }) => ({ id, title }));
