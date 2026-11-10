import { applyChanges, assemblyChanges, disassemblyChanges } from './apply';
import { availableAt } from './stock';
import type { InventoryChange, StockMap, UnitCounts, ValidationIssue, Variant } from './types';
import { validateAssembly, validateDisassembly } from './validate';

export interface WorkspaceState {
  readonly stock: StockMap;
  readonly variantsById: Readonly<Record<string, Variant>>;
}

export interface RunOptions {
  /** Demo switch: pretend another sale changed stock while the user was reviewing. */
  readonly simulateConflict: boolean;
}

export type Outcome =
  | { readonly ok: true; readonly stock: StockMap; readonly changes: readonly InventoryChange[] }
  | { readonly ok: false; readonly kind: 'validation'; readonly issues: readonly ValidationIssue[] }
  | { readonly ok: false; readonly kind: 'conflict'; readonly message: string; readonly stock: StockMap };

const CONFLICT_MESSAGE =
  "Stock changed while you were reviewing (for example, another sale). We've refreshed the quantities - please check and submit again.";

const halveAt = (stock: StockMap, variantId: string | undefined, locationId: string): StockMap => {
  const current = variantId === undefined ? null : availableAt(stock, variantId, locationId);
  return variantId === undefined || current === null
    ? stock
    : { ...stock, [variantId]: { ...stock[variantId], [locationId]: Math.floor(current / 2) } };
};

const conflict = (stock: StockMap): Outcome => ({ ok: false, kind: 'conflict', message: CONFLICT_MESSAGE, stock });

export const runAssembly = (
  state: WorkspaceState,
  req: { kit: Variant | undefined; kitCount: number; perKit: UnitCounts; locationId: string },
  { simulateConflict }: RunOptions,
): Outcome => {
  const issues = validateAssembly({ ...state, ...req });
  if (issues.length > 0 || !req.kit) return { ok: false, kind: 'validation', issues };
  if (simulateConflict) {
    const firstId = Object.entries(req.perKit).find(([, n]) => n > 0)?.[0];
    return conflict(halveAt(state.stock, firstId, req.locationId));
  }
  const changes = assemblyChanges({ ...req, kit: req.kit });
  return { ok: true, stock: applyChanges(state.stock, changes), changes };
};

export const runDisassembly = (
  state: WorkspaceState,
  req: { kit: Variant | undefined; kitCount: number; returned: UnitCounts; locationId: string },
  { simulateConflict }: RunOptions,
): Outcome => {
  const issues = validateDisassembly({ ...state, ...req });
  if (issues.length > 0 || !req.kit) return { ok: false, kind: 'validation', issues };
  if (simulateConflict) return conflict(halveAt(state.stock, req.kit.id, req.locationId));
  const changes = disassemblyChanges({ ...req, kit: req.kit });
  return { ok: true, stock: applyChanges(state.stock, changes), changes };
};
