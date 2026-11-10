import type { KitSize } from '../domain/types';
import type { NewKit } from '../shopify/kits';

export type ParseKitResult = { readonly ok: true; readonly value: NewKit } | { readonly ok: false; readonly error: string };

const SIZES: readonly number[] = [4, 5, 6, 12];
const MAX_TITLE = 255;
const MAX_SKU = 64;
const MAX_BARCODE = 64;

const text = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max ? v.trim() : undefined;

/** Validates the untrusted JSON posted by the create-kit form. */
export const parseNewKit = (raw: unknown): ParseKitResult => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'Invalid request.' };
  const { title, size, sku, barcode } = raw as Record<string, unknown>;
  const cleanTitle = text(title, MAX_TITLE);
  if (!cleanTitle) return { ok: false, error: 'Enter a title.' };
  const cleanSku = text(sku, MAX_SKU);
  if (!cleanSku) return { ok: false, error: 'Enter a SKU.' };
  if (typeof size !== 'number' || !SIZES.includes(size)) return { ok: false, error: 'Choose a kit size.' };
  if (barcode !== undefined && barcode !== '' && !text(barcode, MAX_BARCODE)) return { ok: false, error: 'That barcode is not valid.' };
  const cleanBarcode = text(barcode, MAX_BARCODE);
  return {
    ok: true,
    value: { title: cleanTitle, size: size as KitSize, sku: cleanSku, ...(cleanBarcode ? { barcode: cleanBarcode } : {}) },
  };
};
