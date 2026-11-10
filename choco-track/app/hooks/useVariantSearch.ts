import { useEffect } from "react";
import { useFetcher } from "react-router";
import type { SearchResult } from "../shopify/workspace";

const DEBOUNCE_MS = 250;

type SearchResponse = { ok: true } & SearchResult | { ok: false; message: string; variants: []; stock: Record<string, never> };

/** Debounced server-side variant search (name, SKU or barcode, optional collection). */
export function useVariantSearch(query: string, collectionId: string) {
  const fetcher = useFetcher<SearchResponse>();
  const { load } = fetcher;

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (collectionId) params.set("collection", collectionId);
    const timer = setTimeout(() => load(`/app/api/search?${params.toString()}`), query ? DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [query, collectionId, load]);

  const data = fetcher.data;
  return {
    data,
    loading: fetcher.state !== "idle" || data === undefined,
    error: data && !data.ok ? data.message : undefined,
  };
}
