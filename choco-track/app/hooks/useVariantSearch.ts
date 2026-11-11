import { useEffect, useState } from "react";
import { fetchJson } from "../lib/fetchJson";
import type { CatalogResult } from "../shopify/catalog";

const DEBOUNCE_MS = 250;

type SearchResponse = ({ ok: true; limit: number } & CatalogResult) | { ok: false; message: string };

/** Debounced server-side variant search (name, SKU or barcode, optional collection). Failures keep the last results. */
export function useVariantSearch(query: string, collectionId: string, limit: number) {
  const [data, setData] = useState<(CatalogResult & { limit: number }) | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (collectionId) params.set("collection", collectionId);
    params.set("limit", String(limit));
    let current = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await fetchJson<SearchResponse>(`/app/api/search?${params.toString()}`);
      if (!current) return; // a newer search replaced this one
      setLoading(false);
      if (res.ok && res.data.ok) {
        setData(res.data);
        setError(undefined);
      } else {
        setError(res.ok ? (res.data as { message: string }).message : res.message);
      }
    }, query ? DEBOUNCE_MS : 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, collectionId, limit]);

  return { data, loading, error };
}
