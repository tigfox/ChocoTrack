import { BlockStack, Button, Card, Checkbox, InlineStack, Text } from '@shopify/polaris';

interface Props {
  readonly simulateConflict: boolean;
  readonly onSimulateConflict: (v: boolean) => void;
  readonly onReset: () => void;
}

export function DemoControls({ simulateConflict, onSimulateConflict, onReset }: Props) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h2" variant="headingSm">Mockup controls (not part of the real app)</Text>
        <Text as="p" tone="subdued">All data here is fake and lives only in this browser tab.</Text>
        <InlineStack gap="400" blockAlign="center">
          <Checkbox
            label="Simulate: stock changes (e.g. another sale) just before I submit"
            checked={simulateConflict}
            onChange={onSimulateConflict}
          />
          <Button onClick={onReset}>Reset demo data</Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
