import { hasTargets, lowSummary, type LevelMap, type PendingMap } from '../domain/tracking';
import type { ReportProduct } from '../shopify/trackedCatalog';

/** The sidebar count is looked up on every page view, so it is kept briefly rather than re-read each time. */
export const LOW_COUNT_TTL_MS = 60_000;

const cache = new Map<string, { readonly at: number; readonly count: number }>();

export const readLowCount = async (shop: string, compute: () => Promise<number>, now: number = Date.now()): Promise<number> => {
  const hit = cache.get(shop);
  if (hit && now - hit.at < LOW_COUNT_TTL_MS) return hit.count;
  const count = await compute();
  cache.set(shop, { at: now, count });
  return count;
};

/** Called after a change that could alter the count, so the next look is fresh. */
export const forgetLowCount = (shop: string): void => {
  cache.delete(shop);
};

/** Tracked variants that are below their minimum at some location. */
export const computeLowCount = (report: { products: readonly ReportProduct[]; levels: LevelMap; pending: PendingMap }): number =>
  lowSummary(report.products.flatMap((p) => p.variants).filter(hasTargets), report.levels, report.pending).variants;
