import { fieldChecked } from '../wc';

interface Props {
  readonly simulateConflict: boolean;
  readonly onSimulateConflict: (v: boolean) => void;
  readonly onReset: () => void;
}

export function DemoControls({ simulateConflict, onSimulateConflict, onReset }: Props) {
  return (
    <s-section heading="Mockup controls (not part of the real app)">
      <s-stack gap="small">
        <s-text color="subdued">All data here is fake and lives only in this browser tab.</s-text>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-checkbox
            label="Simulate: stock changes (e.g. another sale) just before I submit"
            checked={simulateConflict}
            onInput={(e) => onSimulateConflict(fieldChecked(e))}
          />
          <s-button onClick={onReset}>Reset demo data</s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
