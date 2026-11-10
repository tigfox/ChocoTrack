import { useState } from 'react';
import { Layout } from '@shopify/polaris';
import { LOCATIONS } from '../data/catalog';
import { sumUnits } from '../domain/stock';
import { isKit, type UnitCounts, type Variant } from '../domain/types';
import { validateDisassembly } from '../domain/validate';
import { runDisassembly, type Outcome, type WorkspaceState } from '../domain/workflow';
import { FlavorPicker } from './FlavorPicker';
import { KitFields } from './KitFields';
import { MixSummary } from './MixSummary';
import { ResultBanner } from './ResultBanner';

interface Props {
  readonly state: WorkspaceState;
  readonly variants: readonly Variant[];
  readonly simulateConflict: boolean;
  readonly onStockChange: (stock: WorkspaceState['stock']) => void;
}

interface Result {
  readonly outcome: Outcome;
  readonly label: string;
  readonly locationName: string;
}

export function DisassembleView({ state, variants, simulateConflict, onStockChange }: Props) {
  const kits = variants.filter(isKit);
  const [locationId, setLocationId] = useState(LOCATIONS[0]?.id ?? '');
  const [kitId, setKitId] = useState(kits[0]?.id ?? '');
  const [kitCountRaw, setKitCountRaw] = useState('1');
  const [returned, setReturned] = useState<UnitCounts>({});
  const [result, setResult] = useState<Result | undefined>();

  const kit = state.variantsById[kitId];
  const kitCount = Number(kitCountRaw);
  const issues = validateDisassembly({ ...state, locationId, kit, kitCount, returned });
  const locationName = LOCATIONS.find((l) => l.id === locationId)?.name ?? '';
  const target = kit?.kitSize !== undefined && Number.isInteger(kitCount) && kitCount >= 1 ? kit.kitSize * kitCount : 0;

  const submit = () => {
    const outcome = runDisassembly(state, { kit, kitCount, returned, locationId }, { simulateConflict });
    if (outcome.ok || outcome.kind === 'conflict') onStockChange(outcome.stock);
    if (outcome.ok) setReturned({});
    setResult({ outcome, locationName, label: `Disassembled ${kitCount} x ${kit?.title ?? 'kit'}` });
  };

  return (
    <Layout>
      {result && (
        <Layout.Section>
          <ResultBanner {...result} variantsById={state.variantsById} onDismiss={() => setResult(undefined)} />
        </Layout.Section>
      )}
      <Layout.Section>
        <div style={{ display: 'grid', gap: 16 }}>
          <KitFields
            heading="Where and what"
            stock={state.stock}
            kits={kits}
            locationId={locationId}
            onLocation={setLocationId}
            kitId={kitId}
            onKit={setKitId}
            kitCount={kitCountRaw}
            onKitCount={setKitCountRaw}
            countLabel="Kits to break down"
          />
          <FlavorPicker
            heading="Enter the mini bars being returned to stock"
            variants={variants}
            stock={state.stock}
            locationId={locationId}
            counts={returned}
            onChange={setReturned}
          />
        </div>
      </Layout.Section>
      <Layout.Section variant="oneThird">
        <MixSummary
          heading="Units returned"
          progressLabel={`mini bars returned in total (needs exactly ${target})`}
          units={sumUnits(returned)}
          target={target}
          chosen={Object.entries(returned).map(([id, n]) => [state.variantsById[id]?.title ?? id, n] as const)}
          issues={issues}
          actionLabel="Break down kits"
          onAction={submit}
        />
      </Layout.Section>
    </Layout>
  );
}
