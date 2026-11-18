import type { KitSize, UnitCounts, Variant } from './types';

export interface BoxLayout {
  readonly rows: number;
  readonly cols: number;
}

const MAX_COLS = 6;

/** Boxes up to 6 bars are one row; larger boxes fill rows of 6 (a 12-pack is 2x6). */
export const boxLayout = (size: KitSize): BoxLayout =>
  size <= MAX_COLS ? { rows: 1, cols: size } : { rows: Math.ceil(size / MAX_COLS), cols: MAX_COLS };

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
