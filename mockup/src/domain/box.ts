import type { KitSize, UnitCounts, Variant } from './types';

export interface BoxLayout {
  readonly rows: number;
  readonly cols: number;
}

/** Physical box layouts: 4-pack 1x4, 6-pack 1x6, 12-pack 2x6. */
export const boxLayout = (size: KitSize): BoxLayout => (size === 12 ? { rows: 2, cols: 6 } : { rows: 1, cols: size });

export interface BoxSlot {
  readonly variantId: string;
  readonly title: string;
  readonly imageUrl?: string;
}

/**
 * One entry per bar in the box: each chosen flavor repeated by its quantity in catalog order,
 * truncated to the kit size and padded with null for empty slots.
 */
export const boxSlots = (
  kit: Variant | undefined,
  perKit: UnitCounts,
  catalog: readonly Variant[],
): readonly (BoxSlot | null)[] => {
  if (!kit?.kitSize) return [];
  const size = kit.kitSize;
  const filled: readonly BoxSlot[] = catalog.flatMap((v) => {
    const n = Math.floor(perKit[v.id] ?? 0);
    const slot: BoxSlot = v.imageUrl === undefined
      ? { variantId: v.id, title: v.title }
      : { variantId: v.id, title: v.title, imageUrl: v.imageUrl };
    return n > 0 ? Array.from({ length: n }, () => slot) : [];
  });
  const clipped = filled.slice(0, size);
  return [...clipped, ...Array.from({ length: size - clipped.length }, () => null)];
};
