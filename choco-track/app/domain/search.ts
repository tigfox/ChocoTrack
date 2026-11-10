import { isKit, type Variant } from './types';

export interface SearchCriteria {
  readonly query: string;
  readonly collectionId: string;
}

const norm = (s: string) => s.trim().toLowerCase();

export const filterComponents = (variants: readonly Variant[], { query, collectionId }: SearchCriteria): readonly Variant[] => {
  const q = norm(query);
  return variants.filter(
    (v) =>
      !isKit(v) &&
      (collectionId === '' || v.collectionIds.includes(collectionId)) &&
      (q === '' || [v.title, v.sku, v.barcode].some((field) => field.toLowerCase().includes(q))),
  );
};

/** Exact SKU/barcode match, for scanner-style entry. */
export const findExactMatch = (variants: readonly Variant[], query: string): Variant | undefined => {
  const q = norm(query);
  return q === ''
    ? undefined
    : variants.find((v) => !isKit(v) && (v.sku.toLowerCase() === q || v.barcode.toLowerCase() === q));
};
