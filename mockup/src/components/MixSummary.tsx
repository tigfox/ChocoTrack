import type { ReactNode } from 'react';
import { BlockStack, Box, Button, Card, Divider, ProgressBar, Text } from '@shopify/polaris';
import type { ValidationIssue } from '../domain/types';

interface Props {
  readonly heading: string;
  readonly progressLabel: string;
  readonly units: number;
  readonly target: number;
  readonly chosen: ReadonlyArray<readonly [string, number]>;
  readonly extra?: ReactNode;
  readonly issues: readonly ValidationIssue[];
  readonly actionLabel: string;
  readonly onAction: () => void;
}

export function MixSummary(p: Props) {
  const tone = p.units === p.target ? 'success' : p.units > p.target ? 'critical' : 'primary';
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">{p.heading}</Text>
        <Text as="p" variant="headingLg">{`${p.units} / ${p.target}`}</Text>
        <Text as="p" tone="subdued">{p.progressLabel}</Text>
        <ProgressBar progress={Math.min(100, p.target === 0 ? 0 : (p.units / p.target) * 100)} tone={tone} size="small" />
        <Divider />
        {p.chosen.length === 0 ? (
          <Text as="p" tone="subdued">No mini bars chosen yet.</Text>
        ) : (
          <BlockStack gap="100">
            {p.chosen.map(([name, qty]) => (
              <Text as="p" key={name}>{`${qty} x ${name}`}</Text>
            ))}
          </BlockStack>
        )}
        {p.extra}
        {p.chosen.length > 0 && p.issues.length > 0 && (
          <Box paddingBlockStart="100">
            <BlockStack gap="100">
              {p.issues.map((i) => (
                <Text as="p" tone="critical" key={`${i.code}-${i.variantId ?? ''}`}>{i.message}</Text>
              ))}
            </BlockStack>
          </Box>
        )}
        <Button variant="primary" size="large" disabled={p.issues.length > 0} onClick={p.onAction}>
          {p.actionLabel}
        </Button>
      </BlockStack>
    </Card>
  );
}
