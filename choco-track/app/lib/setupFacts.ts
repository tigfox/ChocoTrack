import { isMonitored, lowSummary } from '../domain/tracking';
import type { SetupFacts } from '../domain/setup';
import type { InventoryReport } from '../shopify/trackedCatalog';

/** What the setup guide reads from a report to tick its steps. */
export const setupFacts = (report: Pick<InventoryReport, 'products' | 'levels' | 'pending' | 'sourceIds'>): SetupFacts => {
  const monitored = report.products.flatMap((p) => p.variants).filter(isMonitored);
  return {
    flaggedProducts: report.products.length,
    monitoredVariants: monitored.length,
    lowVariants: lowSummary(monitored, report.levels, report.pending).variants,
    sourcesSaved: report.sourceIds.length > 0,
  };
};
