import { Banner, List } from '@shopify/polaris';
import type { Outcome } from '../domain/workflow';
import type { Variant } from '../domain/types';

interface Props {
  readonly outcome: Outcome;
  readonly label: string;
  readonly variantsById: Readonly<Record<string, Variant>>;
  readonly locationName: string;
  readonly onDismiss: () => void;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function ResultBanner({ outcome, label, variantsById, locationName, onDismiss }: Props) {
  if (outcome.ok) {
    return (
      <Banner tone="success" title={`${label} complete`} onDismiss={onDismiss}>
        <p>{`Inventory adjusted at ${locationName} in a single all-or-nothing update:`}</p>
        <List>
          {outcome.changes.map((c) => (
            <List.Item key={c.variantId}>{`${signed(c.delta)}  ${variantsById[c.variantId]?.title ?? c.variantId}`}</List.Item>
          ))}
        </List>
      </Banner>
    );
  }
  if (outcome.kind === 'conflict') {
    return (
      <Banner tone="warning" title="Nothing was changed" onDismiss={onDismiss}>
        <p>{outcome.message}</p>
      </Banner>
    );
  }
  return (
    <Banner tone="critical" title="Can't complete this yet" onDismiss={onDismiss}>
      <List>
        {outcome.issues.map((i) => (
          <List.Item key={`${i.code}-${i.variantId ?? ''}`}>{i.message}</List.Item>
        ))}
      </List>
    </Banner>
  );
}
