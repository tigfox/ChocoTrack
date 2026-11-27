import { applySetupAction, type SetupState } from '../domain/setup';
import { isMonitored } from '../domain/tracking';
import type { LevelMap } from '../domain/tracking';
import type { GraphqlClient } from '../shopify/client';
import { friendlyMessage } from '../shopify/errors';
import { createDraftTransfer, savePackSizes, saveSetup, saveSourceIds, saveVariantTargets, setProductFlag, setVariantUntracked } from '../shopify/inventoryWrites';
import { loadInventoryReport, loadLevels, loadProducts, loadTransferSettings, type ReportProduct } from '../shopify/trackedCatalog';
import { parseFlagInput, parsePackSizesInput, parseSetupInput, parseSourcesInput, parseTargetsInput, parseTransferInput, parseUntrackedInput } from './inventoryInput';
import { logError } from './logError';
import { ensureSetupState } from './ensureSetup';
import { planTransfers } from './planTransfers';
import { setupFacts } from './setupFacts';

export interface CreatedTransfer {
  readonly id: string;
  readonly originId: string;
  readonly destinationId: string;
  readonly lines: ReadonlyArray<{ readonly variantId: string; readonly quantity: number }>;
}

export type InventoryResponse =
  | {
      readonly ok: true;
      readonly message: string;
      readonly product?: ReportProduct;
      readonly levels?: LevelMap;
      readonly digest?: string | null;
      readonly created?: readonly CreatedTransfer[];
      /** The setup guide state after a `setup` change. */
      readonly setup?: SetupState;
    }
  | { readonly ok: false; readonly message: string };

const fail = (message: string): InventoryResponse => ({ ok: false, message });

const setFlag = async (client: GraphqlClient, raw: unknown): Promise<InventoryResponse> => {
  const parsed = parseFlagInput(raw);
  if (!parsed.ok) return fail(parsed.error);
  const { productId, tracked } = parsed.value;
  await setProductFlag(client, productId, tracked);
  const [product] = await loadProducts(client, [productId]);
  const levels = product ? await loadLevels(client, product.variants.map((v) => v.id)) : {};
  const title = product?.title ?? 'the product';
  return {
    ok: true,
    message: tracked ? `Now tracking ${title}.` : `Stopped tracking ${title}.`,
    ...(product ? { product, levels } : {}),
  };
};

const saveTargets = async (client: GraphqlClient, raw: unknown): Promise<InventoryResponse> => {
  const parsed = parseTargetsInput(raw);
  if (!parsed.ok) return fail(parsed.error);
  const { digest } = await saveVariantTargets(client, parsed.value);
  return { ok: true, message: 'Saved targets.', digest };
};

const setUntracked = async (client: GraphqlClient, raw: unknown): Promise<InventoryResponse> => {
  const parsed = parseUntrackedInput(raw);
  if (!parsed.ok) return fail(parsed.error);
  await setVariantUntracked(client, parsed.value.variantId, parsed.value.untracked);
  return { ok: true, message: parsed.value.untracked ? 'Stopped tracking this variant.' : 'Tracking this variant again.' };
};

const saveSources = async (client: GraphqlClient, raw: unknown): Promise<InventoryResponse> => {
  const parsed = parseSourcesInput(raw);
  if (!parsed.ok) return fail(parsed.error);
  await saveSourceIds(client, parsed.value.sourceIds);
  return { ok: true, message: 'Saved source locations.' };
};

const savePackSizesIntent = async (client: GraphqlClient, raw: unknown): Promise<InventoryResponse> => {
  const parsed = parsePackSizesInput(raw);
  if (!parsed.ok) return fail(parsed.error);
  await savePackSizes(client, parsed.value.packSizes);
  return { ok: true, message: 'Saved pack sizes.' };
};

const SETUP_MESSAGES = {
  complete: 'Alerts are on.',
  restart: 'Setup restarted. Alerts are paused until you finish it again.',
  skipTransfers: 'Skipped. You can set up transfers later on the Settings page.',
  dismissGuide: 'Setup guide closed.',
} as const;

const NO_FACTS = { flaggedProducts: 0, monitoredVariants: 0, lowVariants: 0, sourcesSaved: false };

/**
 * A press of a setup guide button. Everything is decided here from Shopify, never from the browser. Restarting needs no read.
 * The full report is read only when it is needed: to check that Turn on alerts is allowed, or to decide a store that has no
 * saved state yet. Other presses need just the saved state.
 */
const setupIntent = async (client: GraphqlClient, raw: unknown): Promise<InventoryResponse> => {
  const parsed = parseSetupInput(raw);
  if (!parsed.ok) return fail(parsed.error);
  const { action } = parsed.value;
  let stored: SetupState | undefined;
  let facts = NO_FACTS;
  if (action !== 'restart') {
    stored = (await loadTransferSettings(client)).setup;
    if (action === 'complete' || stored === undefined) {
      const report = await loadInventoryReport(client);
      stored = await ensureSetupState(client, report);
      facts = setupFacts(report);
    }
  }
  const result = applySetupAction(stored, action, facts);
  if (!result.ok) return fail(result.error);
  await saveSetup(client, result.state);
  return { ok: true, message: SETUP_MESSAGES[action], setup: result.state };
};

const NOTHING = 'Nothing to transfer right now.';

/** Never trusts quantities from the browser: the suggestions are recomputed here from fresh Shopify data. */
const createTransfers = async (client: GraphqlClient, raw: unknown): Promise<InventoryResponse> => {
  const parsed = parseTransferInput(raw);
  if (!parsed.ok) return fail(parsed.error);
  const { key, originId, destinationId } = parsed.value;
  const report = await loadInventoryReport(client);
  if (report.draftsError) return fail(report.draftsError);
  const itemByVariant = new Map(report.products.flatMap((p) => p.variants).filter(isMonitored).map((v) => [v.id, v.inventoryItemId]));
  const groups = planTransfers(report).transfers.filter(
    (t) => originId === undefined || (t.originId === originId && t.destinationId === destinationId),
  );
  if (groups.length === 0) return { ok: true, message: NOTHING, created: [] };
  const created: CreatedTransfer[] = [];
  for (const group of groups) {
    try {
      const { id } = await createDraftTransfer(client, {
        originId: group.originId,
        destinationId: group.destinationId,
        key: `${key}:${group.originId}:${group.destinationId}`,
        lines: group.lines.flatMap((l) => {
          const inventoryItemId = itemByVariant.get(l.variantId);
          return inventoryItemId ? [{ inventoryItemId, quantity: l.quantity }] : [];
        }),
      });
      created.push({ id, ...group });
    } catch (err) {
      logError('draft transfer failed', err, { created: created.length, planned: groups.length });
      return {
        ok: false,
        message: `Created ${created.length} of ${groups.length} draft transfers. ${friendlyMessage(err)}`,
      };
    }
  }
  const noun = created.length === 1 ? 'draft transfer' : 'draft transfers';
  return { ok: true, message: `Created ${created.length} ${noun} in Shopify. Review ${created.length === 1 ? 'it' : 'them'} and mark ${created.length === 1 ? 'it' : 'them'} ready there.`, created };
};

/** One endpoint for the Inventory screen's changes. The body is untrusted JSON. */
export const handleInventory = async (client: GraphqlClient, raw: unknown): Promise<InventoryResponse> => {
  const intent = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).intent : undefined;
  try {
    switch (intent) {
      case 'setFlag':
        return await setFlag(client, raw);
      case 'saveTargets':
        return await saveTargets(client, raw);
      case 'saveSources':
        return await saveSources(client, raw);
      case 'setVariantUntracked':
        return await setUntracked(client, raw);
      case 'savePackSizes':
        return await savePackSizesIntent(client, raw);
      case 'setup':
        return await setupIntent(client, raw);
      case 'createTransfers':
        return await createTransfers(client, raw);
      default:
        return fail('Invalid request.');
    }
  } catch (err) {
    logError('inventory request failed', err, { intent });
    return fail(friendlyMessage(err));
  }
};
