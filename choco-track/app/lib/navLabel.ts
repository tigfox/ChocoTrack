import type { LowStatus } from './lowCount';

/** The sidebar link text: a setup nudge while alerts are off, the low count when there is one, otherwise plain. */
export const navLabel = (status: LowStatus | undefined): string => {
  if (status?.setupNeeded) return 'Inventory (setup)';
  return status && status.count > 0 ? `Inventory (${status.count})` : 'Inventory';
};
