import { packSizeFor, type PackSizes } from '../domain/packSizes';
import { suggestTransfers, type SuggestResult } from '../domain/suggest';
import { isMonitored, type LevelMap, type PendingMap } from '../domain/tracking';
import type { ReportProduct } from '../shopify/trackedCatalog';

export interface PlanInput {
  readonly products: readonly ReportProduct[];
  readonly levels: LevelMap;
  readonly pending: PendingMap;
  readonly sourceIds: readonly string[];
  readonly locations: ReadonlyArray<{ readonly id: string }>;
  /** Pack sizes. Without them nothing is rounded. */
  readonly packSizes?: PackSizes;
}

/** Suggested transfers for what the report shows; the server runs the same function on fresh data before creating anything. */
export const planTransfers = ({ products, levels, pending, sourceIds, locations, packSizes }: PlanInput): SuggestResult =>
  suggestTransfers({
    variants: products.flatMap((p) => p.variants).filter(isMonitored),
    levels,
    pending,
    sourceIds,
    locationIds: locations.map((l) => l.id),
    ...(packSizes ? { multipleOf: (v) => packSizeFor(packSizes, v.id) } : {}),
  });
