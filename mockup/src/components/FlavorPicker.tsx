import { useState } from 'react';
import { Badge, BlockStack, Button, Card, InlineStack, Select, Text, TextField } from '@shopify/polaris';
import { COLLECTIONS, DEFAULT_COLLECTION_ID } from '../data/catalog';
import { parseCount, withCount } from '../domain/counts';
import { filterComponents, findExactMatch } from '../domain/search';
import { availableAt } from '../domain/stock';
import type { StockMap, UnitCounts, Variant } from '../domain/types';

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

const COLLECTION_OPTIONS = [
  { label: 'All items', value: '' },
  ...COLLECTIONS.map((c) => ({ label: c.title, value: c.id })),
];

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
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">{heading}</Text>
        <InlineStack gap="300" wrap={false} blockAlign="end">
          <div style={{ flex: 2 }} onKeyDown={(e) => addScanned(e.key)}>
            <TextField
              label="Search"
              value={query}
              onChange={setQuery}
              placeholder="Name, SKU or barcode - press Enter on an exact SKU/barcode to add one"
              autoComplete="off"
              clearButton
              onClearButtonClick={() => setQuery('')}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Select label="Collection" options={COLLECTION_OPTIONS} value={collectionId} onChange={setCollectionId} />
          </div>
        </InlineStack>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          <BlockStack gap="200">
            {rows.length === 0 && <Text as="p" tone="subdued">No items match.</Text>}
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
          </BlockStack>
        </div>
      </BlockStack>
    </Card>
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
    <InlineStack align="space-between" blockAlign="center" wrap={false} gap="300">
      <BlockStack gap="050">
        <Text as="span" fontWeight={count > 0 ? 'bold' : 'regular'}>{variant.title}</Text>
        <Text as="span" tone="subdued" variant="bodySm">
          {variant.sku} - {available === null ? 'not stocked here' : `${available} available`}
        </Text>
      </BlockStack>
      <InlineStack gap="200" blockAlign="center" wrap={false}>
        {available === null && <Badge tone="critical">Not stocked</Badge>}
        {short > 0 && <Badge tone="warning">{`Short by ${short}`}</Badge>}
        <Button accessibilityLabel={`Remove one ${variant.title}`} disabled={count <= 0} onClick={() => onCount(count - 1)}>-</Button>
        <div style={{ width: 72 }}>
          <TextField
            label={`${variant.title} quantity`}
            labelHidden
            type="number"
            min={0}
            autoComplete="off"
            value={count === 0 ? '' : String(count)}
            placeholder="0"
            onChange={(raw) => onCount(parseCount(raw))}
          />
        </div>
        <Button accessibilityLabel={`Add one ${variant.title}`} onClick={() => onCount(count + 1)}>+</Button>
      </InlineStack>
    </InlineStack>
  );
}
