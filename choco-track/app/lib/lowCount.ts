import { resolveSetup } from '../domain/setup';
import { isMonitored, lowSummary, type LevelMap, type PendingMap } from '../domain/tracking';
import type { GraphqlClient } from '../shopify/client';
import { loadInventoryReport, loadTransferSettings, type InventoryReport, type ReportProduct } from '../shopify/trackedCatalog';
import { ensureSetupState } from './ensureSetup';
import { setupFacts } from './setupFacts';

/** The sidebar count is looked up on every page view, so it is kept briefly rather than re-read each time. */
export const LOW_COUNT_TTL_MS = 60_000;

/** What the sidebar shows: the number of low variants, or that setup is not finished (and so no alerts). */
export interface LowStatus {
  readonly count: number;
  readonly setupNeeded: boolean;
}

const cache = new Map<string, { readonly at: number; readonly status: LowStatus }>();
/** Bumped by every forget, so a lookup that began before a change cannot store its older answer afterwards. */
const generations = new Map<string, number>();

export const readLowStatus = async (shop: string, compute: () => Promise<LowStatus>, now: number = Date.now()): Promise<LowStatus> => {
  const hit = cache.get(shop);
  if (hit && now - hit.at < LOW_COUNT_TTL_MS) return hit.status;
  const generation = generations.get(shop) ?? 0;
  const status = await compute();
  if ((generations.get(shop) ?? 0) === generation) cache.set(shop, { at: now, status });
  return status;
};

/** Called after a change that could alter the count, so the next look is fresh. */
export const forgetLowCount = (shop: string): void => {
  generations.set(shop, (generations.get(shop) ?? 0) + 1);
  cache.delete(shop);
};

/** Tracked variants that are below their minimum at some location. */
export const computeLowCount = (report: { products: readonly ReportProduct[]; levels: LevelMap; pending: PendingMap }): number =>
  lowSummary(report.products.flatMap((p) => p.variants).filter(isMonitored), report.levels, report.pending).variants;

/** No alerts, so no count, until setup is complete. */
export const computeLowStatus = (report: Pick<InventoryReport, 'products' | 'levels' | 'pending' | 'sourceIds' | 'setup'>): LowStatus => {
  const setup = resolveSetup(report.setup, setupFacts(report));
  return setup.alertsEnabled ? { count: computeLowCount(report), setupNeeded: false } : { count: 0, setupNeeded: true };
};

/** Reads the cheap setting first: while setup is unfinished the full report is not read at all. */
export const lookupLowStatus = async (client: GraphqlClient): Promise<LowStatus> => {
  const { setup } = await loadTransferSettings(client);
  if (setup && !setup.completed) return { count: 0, setupNeeded: true };
  const report = await loadInventoryReport(client);
  // A store with no saved state is judged once, here, and written down (see ensureSetupState).
  return computeLowStatus({ ...report, setup: await ensureSetupState(client, report) });
};
