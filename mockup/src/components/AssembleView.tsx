import { useState } from 'react';
import { Layout, Text } from '@shopify/polaris';
import { LOCATIONS } from '../data/catalog';
import { maxBuildable, sumUnits } from '../domain/stock';
import { isKit, type UnitCounts, type Variant } from '../domain/types';
import { validateAssembly } from '../domain/validate';
import { runAssembly, type Outcome, type WorkspaceState } from '../domain/workflow';
import { CreateKitModal } from './CreateKitModal';
import { FlavorPicker } from './FlavorPicker';
import { KitFields } from './KitFields';
import { MixSummary } from './MixSummary';
import { ResultBanner } from './ResultBanner';

interface Props {
  readonly state: WorkspaceState;
  readonly variants: readonly Variant[];
  readonly simulateConflict: boolean;
  readonly onStockChange: (stock: WorkspaceState['stock']) => void;
  readonly onCreateKit: (kit: Variant) => void;
}

interface Result {
  readonly outcome: Outcome;
  readonly label: string;
  readonly locationName: string;
}

export function AssembleView({ state, variants, simulateConflict, onStockChange, onCreateKit }: Props) {
  const kits = variants.filter(isKit);
  const [locationId, setLocationId] = useState(LOCATIONS[0]?.id ?? '');
  const [kitId, setKitId] = useState(kits[0]?.id ?? '');
  const [kitCountRaw, setKitCountRaw] = useState('1');
  const [perKit, setPerKit] = useState<UnitCounts>({});
  const [result, setResult] = useState<Result | undefined>();
  const [creating, setCreating] = useState(false);

  const kit = state.variantsById[kitId];
  const kitCount = Number(kitCountRaw);
  const issues = validateAssembly({ ...state, locationId, kit, kitCount, perKit });
  const locationName = LOCATIONS.find((l) => l.id === locationId)?.name ?? '';
  const target = kit?.kitSize ?? 0;
  const validCount = Number.isInteger(kitCount) && kitCount >= 1;

  const submit = () => {
    const outcome = runAssembly(state, { kit, kitCount, perKit, locationId }, { simulateConflict });
    if (outcome.ok || outcome.kind === 'conflict') onStockChange(outcome.stock);
    if (outcome.ok) setPerKit({});
    setResult({ outcome, locationName, label: `Assembled ${kitCount} x ${kit?.title ?? 'kit'}` });
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
            countLabel="Kits to assemble"
            onCreateKit={() => setCreating(true)}
          />
          <FlavorPicker
            heading={`Choose the mini bars in each ${kit?.title ?? 'kit'}`}
            variants={variants}
            stock={state.stock}
            locationId={locationId}
            counts={perKit}
            onChange={setPerKit}
            demandMultiplier={validCount ? kitCount : 1}
          />
        </div>
      </Layout.Section>
      <Layout.Section variant="oneThird">
        <MixSummary
          heading="Mix per kit"
          progressLabel={`mini bars in each kit (needs exactly ${target})`}
          units={sumUnits(perKit)}
          target={target}
          chosen={Object.entries(perKit).map(([id, n]) => [state.variantsById[id]?.title ?? id, n] as const)}
          extra={
            <Text as="p" tone="subdued">
              {`Max buildable with this mix at ${locationName}: ${maxBuildable(state.stock, perKit, locationId)}`}
            </Text>
          }
          issues={issues}
          actionLabel={`Assemble ${validCount ? kitCount : ''} kit${kitCount === 1 ? '' : 's'}`.replace('  ', ' ')}
          onAction={submit}
        />
      </Layout.Section>
      <CreateKitModal
        open={creating}
        existing={variants}
        onClose={() => setCreating(false)}
        onCreate={(k) => {
          onCreateKit(k);
          setKitId(k.id);
          setCreating(false);
        }}
      />
    </Layout>
  );
}
