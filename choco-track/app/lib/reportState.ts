import type { Targets } from '../domain/targets';
import type { LevelMap, PendingMap } from '../domain/tracking';
import type { ReportProduct } from '../shopify/trackedCatalog';
import type { CreatedTransfer } from './handleInventory';

/** A copy with one variant's targets and digest replaced (after a save). */
export const withVariantTargets = (
  products: readonly ReportProduct[],
  variantId: string,
  targets: Targets,
  digest: string | null,
): readonly ReportProduct[] =>
  products.map((p) =>
    p.variants.some((v) => v.id === variantId)
      ? { ...p, variants: p.variants.map((v) => (v.id === variantId ? { ...v, targets, digest } : v)) }
      : p,
  );

export const upsertProduct = (products: readonly ReportProduct[], product: ReportProduct): readonly ReportProduct[] =>
  [...products.filter((p) => p.id !== product.id), product].sort((a, b) => a.title.localeCompare(b.title));

export const removeProduct = (products: readonly ReportProduct[], productId: string): readonly ReportProduct[] =>
  products.filter((p) => p.id !== productId);

export const mergeLevels = (current: LevelMap, update: LevelMap): LevelMap =>
  Object.entries(update).reduce<LevelMap>((acc, [variantId, byLocation]) => ({ ...acc, [variantId]: { ...acc[variantId], ...byLocation } }), current);

/** Draft transfers just created count as "on the way" straight away, before the next read. */
export const addPending = (pending: PendingMap, created: readonly CreatedTransfer[]): PendingMap =>
  created
    .flatMap((t) => t.lines.map((l) => ({ variantId: l.variantId, destinationId: t.destinationId, quantity: l.quantity })))
    .reduce<PendingMap>(
      (acc, { variantId, destinationId, quantity }) => ({
        ...acc,
        [variantId]: { ...acc[variantId], [destinationId]: (acc[variantId]?.[destinationId] ?? 0) + quantity },
      }),
      pending,
    );

/**
 * A fresh server read, with what the person did a moment ago applied on top: Shopify's product search lags a few
 * seconds behind a flag change, so a product just flagged on stays, and one just flagged off stays out.
 */
export const reconcileProducts = (
  server: readonly ReportProduct[],
  previous: readonly ReportProduct[],
  overrides: Readonly<Record<string, boolean>>,
): readonly ReportProduct[] => {
  const kept = server.filter((p) => overrides[p.id] !== false);
  const added = previous.filter((p) => overrides[p.id] === true && !server.some((s) => s.id === p.id));
  return [...kept, ...added].sort((a, b) => a.title.localeCompare(b.title));
};
