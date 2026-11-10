import type { SearchOptions } from "../shopify/catalog";

export const PAGE_SIZE = 50;
export const MAX_RESULTS = 250;
const MAX_TEXT = 100;
const COLLECTION_GID = /^gid:\/\/shopify\/Collection\/\d+$/;

/** Reads `?q=&collection=&limit=` from an untrusted URL into safe search options. */
export const parseSearchParams = (params: URLSearchParams): Required<Pick<SearchOptions, "text" | "first">> & Pick<SearchOptions, "collectionId"> => {
  const collection = params.get("collection") ?? "";
  const limit = Number(params.get("limit") ?? PAGE_SIZE);
  return {
    text: (params.get("q") ?? "").slice(0, MAX_TEXT),
    first: Number.isInteger(limit) && limit >= 1 ? Math.min(limit, MAX_RESULTS) : PAGE_SIZE,
    ...(COLLECTION_GID.test(collection) ? { collectionId: collection } : {}),
  };
};
