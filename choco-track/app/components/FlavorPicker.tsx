import { useEffect, useState } from "react";
import { parseCount, withCount } from "../domain/counts";
import { findExactMatch } from "../domain/search";
import { availableAt } from "../domain/stock";
import type { Collection, StockMap, UnitCounts, Variant } from "../domain/types";
import { fieldValue } from "../wc";

interface Props {
  readonly heading: string;
  /** Search results for the current query and collection. */
  readonly variants: readonly Variant[];
  readonly collections: readonly Collection[];
  readonly stock: StockMap;
  readonly locationId: string;
  readonly counts: UnitCounts;
  readonly onChange: (counts: UnitCounts) => void;
  readonly query: string;
  readonly onQuery: (q: string) => void;
  readonly collectionId: string;
  readonly onCollection: (id: string) => void;
  readonly loading: boolean;
  readonly canShowMore: boolean;
  readonly onShowMore: () => void;
  readonly error?: string | undefined;
  /** When set, a row is flagged if counts x multiplier exceeds available stock. */
  readonly demandMultiplier?: number;
}

export function FlavorPicker(p: Props) {
  const { variants, counts, query, onChange, onQuery } = p;
  const [scanPending, setScanPending] = useState(false);
  const rows = variants.filter((v) => v.kitSize === undefined);

  const setCount = (id: string, n: number) => onChange(withCount(counts, id, n));

  // Scanner-style entry: Enter adds the exact SKU/barcode match as soon as the search results include it.
  useEffect(() => {
    if (!scanPending) return;
    const match = findExactMatch(variants, query);
    if (!match) return;
    onChange(withCount(counts, match.id, (counts[match.id] ?? 0) + 1));
    onQuery("");
    setScanPending(false);
  }, [scanPending, variants, query, counts, onChange, onQuery]);

  return (
    <s-section heading={p.heading}>
      <s-stack gap="base">
        <s-grid gridTemplateColumns="2fr 1fr" gap="base">
          <div role="presentation" onKeyDown={(e) => e.key === "Enter" && setScanPending(true)}>
            <s-search-field
              label="Search"
              value={query}
              placeholder="Name, SKU or barcode (Enter adds an exact match)"
              onInput={(e) => {
                setScanPending(false);
                onQuery(fieldValue(e));
              }}
            />
          </div>
          <s-select label="Collection" value={p.collectionId} onInput={(e) => p.onCollection(fieldValue(e))}>
            <s-option value="">All items</s-option>
            {p.collections.map((c) => (
              <s-option key={c.id} value={c.id}>{c.title}</s-option>
            ))}
          </s-select>
        </s-grid>
        {p.error && <s-banner tone="critical">{p.error}</s-banner>}
        <div style={{ maxHeight: 420, overflowY: "auto" }} aria-busy={p.loading}>
          <s-stack gap="small">
            {p.loading && rows.length === 0 && <s-text color="subdued">Searching...</s-text>}
            {!p.loading && rows.length === 0 && <s-text color="subdued">No items match.</s-text>}
            {rows.map((v) => (
              <PickerRow
                key={v.id}
                variant={v}
                available={availableAt(p.stock, v.id, p.locationId)}
                count={counts[v.id] ?? 0}
                demandMultiplier={p.demandMultiplier}
                onCount={(n) => setCount(v.id, n)}
              />
            ))}
          </s-stack>
        </div>
        {p.canShowMore && !p.loading && (
          <div>
            <s-button variant="tertiary" onClick={p.onShowMore}>Show more</s-button>
          </div>
        )}
      </s-stack>
    </s-section>
  );
}

interface RowProps {
  readonly variant: Variant;
  readonly available: number | null;
  readonly count: number;
  readonly demandMultiplier: number | undefined;
  readonly onCount: (n: number) => void;
}

function PickerRow({ variant, available, count, demandMultiplier, onCount }: RowProps) {
  const short = demandMultiplier !== undefined && available !== null ? count * demandMultiplier - available : 0;
  return (
    <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base" data-testid={`row-${variant.sku}`}>
      <s-stack gap="none">
        <s-text fontWeight={count > 0 ? "bold" : "base"}>{variant.title}</s-text>
        <s-text color="subdued">
          {variant.sku} - {available === null ? "not stocked here" : `${available} available`}
        </s-text>
      </s-stack>
      <s-stack direction="inline" gap="small" alignItems="center">
        {available === null && <s-badge tone="critical">Not stocked</s-badge>}
        {short > 0 && <s-badge tone="warning">{`Short by ${short}`}</s-badge>}
        <s-button accessibilityLabel={`Remove one ${variant.title}`} disabled={count <= 0} onClick={() => onCount(count - 1)}>-</s-button>
        <div style={{ width: 96 }}>
          <s-number-field
            label={`${variant.title} quantity`}
            labelAccessibilityVisibility="exclusive"
            min={0}
            placeholder="0"
            value={count === 0 ? "" : String(count)}
            onInput={(e) => onCount(parseCount(fieldValue(e)))}
          />
        </div>
        <s-button accessibilityLabel={`Add one ${variant.title}`} onClick={() => onCount(count + 1)}>+</s-button>
      </s-stack>
    </s-stack>
  );
}
