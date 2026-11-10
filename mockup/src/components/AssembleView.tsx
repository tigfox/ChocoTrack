import { useCallback, useState } from 'react';
import { DEFAULT_KIT_ID, LOCATIONS } from '../data/catalog';
import { buildPickList } from '../domain/pickList';
import { maxBuildable, sumUnits } from '../domain/stock';
import { isKit, type UnitCounts, type Variant } from '../domain/types';
import { validateAssembly } from '../domain/validate';
import { runAssembly, type Outcome, type WorkspaceState } from '../domain/workflow';
import { CreateKitModal } from './CreateKitModal';
import { BoxPreview } from './BoxPreview';
import { FlavorPicker } from './FlavorPicker';
import { KitFields } from './KitFields';
import { MixSummary } from './MixSummary';
import { PickListSheet } from './PickListSheet';
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
  const [kitId, setKitId] = useState(kits.find((k) => k.id === DEFAULT_KIT_ID)?.id ?? kits[0]?.id ?? '');
  const [kitCountRaw, setKitCountRaw] = useState('1');
  const [perKit, setPerKit] = useState<UnitCounts>({});
  const [result, setResult] = useState<Result | undefined>();
  const [creating, setCreating] = useState(false);

  const kit = state.variantsById[kitId];
  const kitCount = Number(kitCountRaw);
  const issues = validateAssembly({ ...state, locationId, kit, kitCount, perKit });
  const pickList = buildPickList({ ...state, mode: 'assemble', kit, kitCount, perKit, locationId });
  const locationName = LOCATIONS.find((l) => l.id === locationId)?.name ?? '';
  const target = kit?.kitSize ?? 0;
  const validCount = Number.isInteger(kitCount) && kitCount >= 1;

  const closeModal = useCallback(() => setCreating(false), []);

  const submit = () => {
    const outcome = runAssembly(state, { kit, kitCount, perKit, locationId }, { simulateConflict });
    if (outcome.ok || outcome.kind === 'conflict') onStockChange(outcome.stock);
    if (outcome.ok) setPerKit({});
    setResult({ outcome, locationName, label: `Assembled ${kitCount} x ${kit?.title ?? 'kit'}` });
  };

  return (
    <s-stack gap="base">
      {result && <ResultBanner {...result} variantsById={state.variantsById} onDismiss={() => setResult(undefined)} />}
      <s-grid gridTemplateColumns="3fr 2fr" gap="base" alignItems="start">
        <s-stack gap="base">
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
        </s-stack>
        <s-stack gap="base">
          <MixSummary
            heading="Mix per kit"
            progressLabel={`mini bars in each kit (needs exactly ${target})`}
            units={sumUnits(perKit)}
            target={target}
            chosen={Object.entries(perKit).map(([id, n]) => [state.variantsById[id]?.title ?? id, n] as const)}
            extra={
              <s-text color="subdued">
                {`Max buildable with this mix at ${locationName}: ${maxBuildable(state.stock, perKit, locationId)}`}
              </s-text>
            }
            issues={issues}
            actionLabel={`Assemble ${validCount ? kitCount : ''} kit${kitCount === 1 ? '' : 's'}`.replace('  ', ' ')}
            onAction={submit}
            secondaryLabel="Print pick list"
            secondaryDisabled={!kit || pickList.rows.length === 0}
            onSecondary={() => window.print()}
          />
          <BoxPreview kit={kit} perKit={perKit} variants={variants} />
        </s-stack>
      </s-grid>
      <PickListSheet list={pickList} locationName={locationName} perKit={perKit} variants={variants} />
      <CreateKitModal
        open={creating}
        existing={variants}
        onClose={closeModal}
        onCreate={(k) => {
          onCreateKit(k);
          setKitId(k.id);
          setCreating(false);
        }}
      />
    </s-stack>
  );
}
