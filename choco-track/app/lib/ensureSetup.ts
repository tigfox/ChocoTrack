import { resolveSetup, type SetupState } from '../domain/setup';
import type { GraphqlClient } from '../shopify/client';
import { saveSetup } from '../shopify/inventoryWrites';
import type { InventoryReport } from '../shopify/trackedCatalog';
import { logError } from './logError';
import { setupFacts } from './setupFacts';

/**
 * The saved setup state, deciding it once if there is none. A store with no saved state is either new or older than the
 * guide; that is judged at the first look and written down, so setting a first target later can never make a new store
 * look old (which would switch alerts on before Turn on alerts). A failed write is logged and the decision still holds
 * for this request.
 */
export const ensureSetupState = async (client: GraphqlClient, report: Pick<InventoryReport, 'setup' | 'products' | 'levels' | 'pending' | 'sourceIds'>): Promise<SetupState> => {
  if (report.setup) return report.setup;
  const { state } = resolveSetup(undefined, setupFacts(report));
  try {
    await saveSetup(client, state);
  } catch (err) {
    logError('setup state could not be saved', err);
  }
  return state;
};
