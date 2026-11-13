const COLLECTION_GID = /^gid:\/\/shopify\/Collection\/\d+$/;
const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d+$/;

const PRODUCT_GID = /^gid:\/\/shopify\/Product\/\d+$/;
const LOCATION_GID = /^gid:\/\/shopify\/Location\/\d+$/;

export const isProductGid = (v: unknown): v is string => typeof v === 'string' && PRODUCT_GID.test(v);
export const isLocationGid = (v: unknown): v is string => typeof v === 'string' && LOCATION_GID.test(v);
export const isCollectionGid = (v: unknown): v is string => typeof v === 'string' && COLLECTION_GID.test(v);
export const isVariantGid = (v: unknown): v is string => typeof v === 'string' && VARIANT_GID.test(v);

/** An optional category: missing or empty means none; anything else must be a collection id. */
export const parseCategory = (v: unknown): { readonly ok: true; readonly id: string | null } | { readonly ok: false } => {
  if (v === undefined || v === '') return { ok: true, id: null };
  return isCollectionGid(v) ? { ok: true, id: v } : { ok: false };
};

export const CATEGORY_ERROR = 'Choose a valid category.';
