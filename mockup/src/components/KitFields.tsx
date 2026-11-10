import { BlockStack, Button, Card, InlineStack, Select, Text, TextField } from '@shopify/polaris';
import { LOCATIONS } from '../data/catalog';
import { availableAt } from '../domain/stock';
import type { StockMap, Variant } from '../domain/types';

interface Props {
  readonly heading: string;
  readonly stock: StockMap;
  readonly kits: readonly Variant[];
  readonly locationId: string;
  readonly onLocation: (id: string) => void;
  readonly kitId: string;
  readonly onKit: (id: string) => void;
  readonly kitCount: string;
  readonly onKitCount: (v: string) => void;
  readonly countLabel: string;
  readonly onCreateKit?: () => void;
}

export function KitFields(p: Props) {
  const kitOptions = p.kits.map((k) => {
    const n = availableAt(p.stock, k.id, p.locationId);
    return { label: `${k.title} (${k.sku}) - ${n === null ? 'not stocked here' : `${n} in stock`}`, value: k.id };
  });
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">{p.heading}</Text>
        <Select
          label="Location"
          options={LOCATIONS.map((l) => ({ label: l.name, value: l.id }))}
          value={p.locationId}
          onChange={p.onLocation}
        />
        <InlineStack gap="300" wrap={false} blockAlign="end">
          <div style={{ flex: 3 }}>
            <Select label="Kit" options={kitOptions} value={p.kitId} onChange={p.onKit} />
          </div>
          <div style={{ flex: 1 }}>
            <TextField label={p.countLabel} type="number" min={1} autoComplete="off" value={p.kitCount} onChange={p.onKitCount} />
          </div>
        </InlineStack>
        {p.onCreateKit && (
          <InlineStack>
            <Button variant="plain" onClick={p.onCreateKit}>Create a new kit</Button>
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}
