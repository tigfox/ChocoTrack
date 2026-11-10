import { assemblyChanges, disassemblyChanges } from '../domain/apply';
import type { InventoryChange, StockMap, UnitCounts, ValidationIssue } from '../domain/types';
import { validateAssembly, validateDisassembly } from '../domain/validate';
import type { CatalogVariant } from './catalog';
import type { GraphqlClient } from './client';
import { logError } from '../lib/logError';
import { friendlyMessage, ShopifyUserErrors } from './errors';
import { adjustInventory, ensureStocked, guardStock, loadStock } from './inventory';

export type SubmitResult =
  | { readonly ok: true; readonly adjustmentId: string; readonly changes: readonly InventoryChange[] }
  | { readonly ok: false; readonly kind: 'validation'; readonly issues: readonly ValidationIssue[] }
  | { readonly ok: false; readonly kind: 'conflict'; readonly message: string; readonly stock: StockMap }
  | { readonly ok: false; readonly kind: 'error'; readonly message: string };

export interface SubmitRequest {
  readonly mode: 'assemble' | 'disassemble';
  readonly kit: CatalogVariant | undefined;
  readonly kitCount: number;
  readonly perKit: UnitCounts;
  readonly locationId: string;
  /** Every variant that can appear in the request (kit and components). */
  readonly variants: readonly CatalogVariant[];
  /** Stock the user saw while building the mix: validation and the compare-and-swap guard. */
  readonly stock: StockMap;
  /** Stock read from Shopify at submit time: decides which levels need activating. Defaults to `stock`. */
  readonly liveStock?: StockMap;
  /** Reused on retry so a double-submit cannot apply twice; omit to generate one. */
  readonly runId?: string;
}

/** A valid Shopify adjustment reason; the referenceDocumentUri says which run it was. */
const REASON = 'correction';

export const submitRun = async (client: GraphqlClient, req: SubmitRequest): Promise<SubmitResult> => {
  const variantsById = Object.fromEntries(req.variants.map((v) => [v.id, v]));
  const state = { stock: req.stock, variantsById, kit: req.kit, kitCount: req.kitCount, perKit: req.perKit, locationId: req.locationId };
  const issues = req.mode === 'assemble' ? validateAssembly(state) : validateDisassembly(state);
  if (issues.length > 0 || !req.kit) return { ok: false, kind: 'validation', issues };

  const args = { kit: req.kit, kitCount: req.kitCount, perKit: req.perKit, locationId: req.locationId };
  const changes = req.mode === 'assemble' ? assemblyChanges(args) : disassemblyChanges(args);
  const inventoryItemIds = Object.fromEntries(req.variants.map((v) => [v.id, v.inventoryItemId]));
  const runId = req.runId ?? crypto.randomUUID();

  try {
    const live = await ensureStocked(client, changes, inventoryItemIds, req.liveStock ?? req.stock);
    const adjustmentId = await adjustInventory(client, {
      changes,
      inventoryItemIds,
      stock: guardStock(req.stock, live, changes),
      reason: REASON,
      referenceDocumentUri: `gid://choco-track/${req.mode === 'assemble' ? 'Assembly' : 'Disassembly'}/${runId}`,
      idempotencyKey: runId,
    });
    return { ok: true, adjustmentId, changes };
  } catch (err) {
    logError('submitRun failed', err, { mode: req.mode, runId });
    if (err instanceof ShopifyUserErrors && err.isStale) {
      const fresh = await loadStock(client, changes.map((c) => c.variantId));
      return { ok: false, kind: 'conflict', message: friendlyMessage(err), stock: { ...req.stock, ...fresh } };
    }
    return { ok: false, kind: 'error', message: friendlyMessage(err) };
  }
};
