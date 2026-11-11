import type { KitSize } from '../domain/types';
import type { KitUpdate } from '../shopify/kits';
import { CATEGORY_ERROR, isVariantGid, parseCategory } from './shopifyIds';

export type ParseUpdateResult = { readonly ok: true; readonly value: KitUpdate } | { readonly ok: false; readonly error: string };

const SIZES: readonly number[] = [4, 5, 6, 12];
const MAX_TITLE = 255;

/** Validates the untrusted JSON posted by the kit settings form. */
export const parseKitUpdate = (raw: unknown): ParseUpdateResult => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'Invalid request.' };
  const { kitId, title, size, categoryId } = raw as Record<string, unknown>;
  if (!isVariantGid(kitId)) return { ok: false, error: 'Invalid request.' };
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  if (cleanTitle === '' || cleanTitle.length > MAX_TITLE) return { ok: false, error: 'Enter a title.' };
  if (typeof size !== 'number' || !SIZES.includes(size)) return { ok: false, error: 'Choose a kit size.' };
  const category = parseCategory(categoryId);
  if (!category.ok) return { ok: false, error: CATEGORY_ERROR };
  return { ok: true, value: { variantId: kitId, title: cleanTitle, size: size as KitSize, categoryId: category.id } };
};
