import { kitSizeError } from '../domain/kitSize';
import type { KitLink } from '../shopify/kits';
import { CATEGORY_ERROR, isVariantGid, parseCategory } from './shopifyIds';

export type ParseLinkResult = { readonly ok: true; readonly value: KitLink } | { readonly ok: false; readonly error: string };

/** Validates the untrusted JSON posted by the "use an existing product as a kit" form. */
export const parseLinkKit = (raw: unknown): ParseLinkResult => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'Invalid request.' };
  const { variantId, size, categoryId } = raw as Record<string, unknown>;
  if (!isVariantGid(variantId)) return { ok: false, error: 'Choose the product to use as a kit.' };
  const sizeProblem = kitSizeError(size);
  if (sizeProblem) return { ok: false, error: sizeProblem };
  const category = parseCategory(categoryId);
  if (!category.ok) return { ok: false, error: CATEGORY_ERROR };
  return { ok: true, value: { variantId, size: size as number, categoryId: category.id } };
};
