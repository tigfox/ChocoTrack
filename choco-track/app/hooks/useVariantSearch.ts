import { useEffect } from "react";
import { useFetcher } from "react-router";
import type { CatalogResult } from "../shopify/catalog";

const DEBOUNCE_MS = 250;

type SearchResponse = ({ ok: true; limit: number } & CatalogResult) | { ok: false; message: string; variants: []; stock: Record<string, never> };

/** Debounced server-side variant search (name, SKU or barcode, optional collection). */
export function useVariantSearch(query: string, collectionId: string, limit: number) {
  const fetcher = useFetcher<SearchResponse>();
  const { load } = fetcher;

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (collectionId) params.set("collection", collectionId);
    params.set("limit", String(limit));
    const timer = setTimeout(() => load(`/app/api/search?${params.toString()}`), query ? DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [query, collectionId, limit, load]);

  const data = fetcher.data;
  return {
    data,
    loading: fetcher.state !== "idle" || data === undefined,
    error: data && !data.ok ? data.message : undefined,
  };
}
