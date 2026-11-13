import { useEffect, useState } from "react";
import type { Collection } from "../domain/types";
import { useModal } from "../hooks/useModal";
import { fromOptionValue, NO_OPTION, toOptionValue } from "../lib/emptyOption";
import { fetchJson } from "../lib/fetchJson";
import type { InventoryResponse } from "../lib/handleInventory";
import type { FlagCandidate } from "../shopify/inventoryWrites";
import { fieldValue } from "../wc";

interface Props {
  readonly open: boolean;
  readonly collections: readonly Collection[];
  /** Products flagged in this session or loaded flagged, so the buttons reflect what was just done. */
  readonly trackedIds: ReadonlySet<string>;
  readonly onClose: () => void;
  readonly onFlag: (productId: string, tracked: boolean) => Promise<InventoryResponse>;
}

type SearchResponse = { ok: true; products: readonly FlagCandidate[] } | { ok: false; message: string };

const DEBOUNCE_MS = 250;

export function AddProductsModal({ open, collections, trackedIds, onClose, onFlag }: Props) {
  const ref = useModal(open, onClose);
  const [query, setQuery] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [results, setResults] = useState<readonly FlagCandidate[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return undefined;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (collectionId) params.set("collection", collectionId);
    let current = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await fetchJson<SearchResponse>(`/app/api/inventory-search?${params.toString()}`);
      if (!current) return;
      setLoading(false);
      if (res.ok && res.data.ok) {
        setResults(res.data.products);
        setError(undefined);
      } else {
        setError(res.ok ? (res.data as { message: string }).message : res.message);
      }
    }, query ? DEBOUNCE_MS : 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, query, collectionId]);

  const toggle = async (product: FlagCandidate, tracked: boolean) => {
    setBusyId(product.id);
    const result = await onFlag(product.id, tracked);
    setBusyId(undefined);
    setError(result.ok ? undefined : result.message);
  };

  return (
    <s-modal ref={ref} heading="Add products to track" id="add-products-modal">
      <s-stack gap="base">
        <s-paragraph color="subdued">
          Tracking a product adds its variants to the report. Give a variant a minimum and maximum for a location and it is tracked there.
        </s-paragraph>
        {error && <s-banner tone="critical">{error}</s-banner>}
        <s-grid gridTemplateColumns="2fr 1fr" gap="base">
          <s-search-field label="Search" value={query} placeholder="Product name" onInput={(e) => setQuery(fieldValue(e))} />
          <s-select label="Collection" value={toOptionValue(collectionId)} onInput={(e) => setCollectionId(fromOptionValue(fieldValue(e)))}>
            <s-option value={NO_OPTION}>All products</s-option>
            {collections.map((c) => (
              <s-option key={c.id} value={c.id}>{c.title}</s-option>
            ))}
          </s-select>
        </s-grid>
        {loading && <s-text color="subdued">Searching...</s-text>}
        {!loading && results.length === 0 && !error && <s-text color="subdued">No products found.</s-text>}
        <s-stack gap="small-200">
          {results.map((p) => {
            const tracked = trackedIds.has(p.id);
            return (
              <s-stack key={p.id} direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  {p.imageUrl && <s-thumbnail src={p.imageUrl} alt="" size="small" />}
                  <s-stack gap="none">
                    <s-text type="strong">{p.title}</s-text>
                    <s-text color="subdued">{`${p.variantCount} variant${p.variantCount === 1 ? "" : "s"}`}</s-text>
                  </s-stack>
                </s-stack>
                <s-button
                  variant={tracked ? "secondary" : "primary"}
                  disabled={busyId !== undefined}
                  loading={busyId === p.id}
                  onClick={() => void toggle(p, !tracked)}
                >
                  {tracked ? "Stop tracking" : "Track"}
                </s-button>
              </s-stack>
            );
          })}
        </s-stack>
      </s-stack>
      <s-button slot="primary-action" variant="primary" onClick={onClose}>Done</s-button>
    </s-modal>
  );
}
