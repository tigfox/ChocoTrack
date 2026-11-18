import { kitSizeError } from '../domain/kitSize';
import type { KitUpdate } from '../shopify/kits';
import { CATEGORY_ERROR, isVariantGid, parseCategory } from './shopifyIds';

export type ParseUpdateResult = { readonly ok: true; readonly value: KitUpdate } | { readonly ok: false; readonly error: string };

const MAX_TITLE = 255;

/** Validates the untrusted JSON posted by the kit settings form. */
export const parseKitUpdate = (raw: unknown): ParseUpdateResult => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'Invalid request.' };
  const { kitId, title, size, categoryId } = raw as Record<string, unknown>;
  if (!isVariantGid(kitId)) return { ok: false, error: 'Invalid request.' };
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  if (cleanTitle === '' || cleanTitle.length > MAX_TITLE) return { ok: false, error: 'Enter a title.' };
  const sizeProblem = kitSizeError(size);
  if (sizeProblem) return { ok: false, error: sizeProblem };
  const category = parseCategory(categoryId);
  if (!category.ok) return { ok: false, error: CATEGORY_ERROR };
  return { ok: true, value: { variantId: kitId, title: cleanTitle, size: size as number, categoryId: category.id } };
};
