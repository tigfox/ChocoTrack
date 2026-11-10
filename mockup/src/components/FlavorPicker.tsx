import { useState } from 'react';
import { COLLECTIONS, DEFAULT_COLLECTION_ID } from '../data/catalog';
import { parseCount, withCount } from '../domain/counts';
import { filterComponents, findExactMatch } from '../domain/search';
import { availableAt } from '../domain/stock';
import type { StockMap, UnitCounts, Variant } from '../domain/types';
import { fieldValue } from '../wc';

interface Props {
  readonly heading: string;
  readonly variants: readonly Variant[];
  readonly stock: StockMap;
  readonly locationId: string;
  readonly counts: UnitCounts;
  readonly onChange: (counts: UnitCounts) => void;
  /** When set, a row is flagged if counts x multiplier exceeds available stock. */
  readonly demandMultiplier?: number;
}

export function FlavorPicker({ heading, variants, stock, locationId, counts, onChange, demandMultiplier }: Props) {
  const [query, setQuery] = useState('');
  const [collectionId, setCollectionId] = useState(DEFAULT_COLLECTION_ID);
  const rows = filterComponents(variants, { query, collectionId });

  const setCount = (id: string, n: number) => onChange(withCount(counts, id, n));

  const addScanned = (key: string) => {
    if (key !== 'Enter') return;
    const match = findExactMatch(variants, query);
    if (!match) return;
    setCount(match.id, (counts[match.id] ?? 0) + 1);
    setQuery('');
  };

  return (
    <s-section heading={heading}>
      <s-stack gap="base">
        <s-grid gridTemplateColumns="2fr 1fr" gap="base">
          <div onKeyDown={(e) => addScanned(e.key)}>
            <s-search-field
              label="Search"
              value={query}
              placeholder="Name, SKU or barcode (Enter adds an exact match)"
              onInput={(e) => setQuery(fieldValue(e))}
            />
          </div>
          <s-select label="Collection" value={collectionId} onInput={(e) => setCollectionId(fieldValue(e))}>
            <s-option value="">All items</s-option>
            {COLLECTIONS.map((c) => (
              <s-option key={c.id} value={c.id}>{c.title}</s-option>
            ))}
          </s-select>
        </s-grid>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          <s-stack gap="small">
            {rows.length === 0 && <s-text color="subdued">No items match.</s-text>}
            {rows.map((v) => (
              <PickerRow
                key={v.id}
                variant={v}
                available={availableAt(stock, v.id, locationId)}
                count={counts[v.id] ?? 0}
                demandMultiplier={demandMultiplier}
                onCount={(n) => setCount(v.id, n)}
              />
            ))}
          </s-stack>
        </div>
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
    <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base" data-testid={`row-${variant.id}`}>
      <s-stack gap="none">
        <s-text fontWeight={count > 0 ? 'bold' : 'base'}>{variant.title}</s-text>
        <s-text color="subdued">
          {variant.sku} - {available === null ? 'not stocked here' : `${available} available`}
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
            value={count === 0 ? '' : String(count)}
            onInput={(e) => onCount(parseCount(fieldValue(e)))}
          />
        </div>
        <s-button accessibilityLabel={`Add one ${variant.title}`} onClick={() => onCount(count + 1)}>+</s-button>
      </s-stack>
    </s-stack>
  );
}
