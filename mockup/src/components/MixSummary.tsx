import type { ReactNode } from 'react';
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
  const tone = p.units === p.target ? 'success' : p.units > p.target ? 'critical' : 'info';
  return (
    <s-section heading={p.heading}>
      <s-stack gap="base">
        <s-heading fontSize="large-200" data-testid="unit-total">{`${p.units} / ${p.target}`}</s-heading>
        <s-text color="subdued">{p.progressLabel}</s-text>
        <s-progress value={p.target === 0 ? 0 : Math.min(100, (p.units / p.target) * 100)} max={100} tone={tone} accessibilityLabel="Mini bars chosen" />
        <s-divider />
        {p.chosen.length === 0 ? (
          <s-text color="subdued">No mini bars chosen yet.</s-text>
        ) : (
          <s-stack gap="none">
            {p.chosen.map(([name, qty]) => (
              <s-text key={name}>{`${qty} x ${name}`}</s-text>
            ))}
          </s-stack>
        )}
        {p.extra}
        {p.chosen.length > 0 && p.issues.length > 0 && (
          <s-stack gap="small">
            {p.issues.map((i) => (
              <s-text key={`${i.code}-${i.variantId ?? ''}`} tone="critical">{i.message}</s-text>
            ))}
          </s-stack>
        )}
        <s-button variant="primary" inlineSize="fill" disabled={p.issues.length > 0} onClick={p.onAction}>
          {p.actionLabel}
        </s-button>
      </s-stack>
    </s-section>
  );
}
