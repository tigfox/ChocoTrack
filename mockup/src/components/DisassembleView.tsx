import { useState } from 'react';
import { DEFAULT_KIT_ID, LOCATIONS } from '../data/catalog';
import { buildPickList } from '../domain/pickList';
import { sumUnits } from '../domain/stock';
import { isKit, type UnitCounts, type Variant } from '../domain/types';
import { validateDisassembly } from '../domain/validate';
import { runDisassembly, type Outcome, type WorkspaceState } from '../domain/workflow';
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
}

interface Result {
  readonly outcome: Outcome;
  readonly label: string;
  readonly locationName: string;
}

export function DisassembleView({ state, variants, simulateConflict, onStockChange }: Props) {
  const kits = variants.filter(isKit);
  const [locationId, setLocationId] = useState(LOCATIONS[0]?.id ?? '');
  const [kitId, setKitId] = useState(kits.find((k) => k.id === DEFAULT_KIT_ID)?.id ?? kits[0]?.id ?? '');
  const [kitCountRaw, setKitCountRaw] = useState('1');
  const [perKit, setPerKit] = useState<UnitCounts>({});
  const [result, setResult] = useState<Result | undefined>();

  const kit = state.variantsById[kitId];
  const kitCount = Number(kitCountRaw);
  const issues = validateDisassembly({ ...state, locationId, kit, kitCount, perKit });
  const pickList = buildPickList({ ...state, mode: 'disassemble', kit, kitCount, perKit, locationId });
  const locationName = LOCATIONS.find((l) => l.id === locationId)?.name ?? '';
  const target = kit?.kitSize ?? 0;
  const validCount = Number.isInteger(kitCount) && kitCount >= 1;

  const submit = () => {
    const outcome = runDisassembly(state, { kit, kitCount, perKit, locationId }, { simulateConflict });
    if (outcome.ok || outcome.kind === 'conflict') onStockChange(outcome.stock);
    if (outcome.ok) setPerKit({});
    setResult({ outcome, locationName, label: `Disassembled ${kitCount} x ${kit?.title ?? 'kit'}` });
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
            countLabel="Kits to break down"
          />
          <FlavorPicker
            heading={`Choose the mini bars in each ${kit?.title ?? 'kit'} being broken down`}
            variants={variants}
            stock={state.stock}
            locationId={locationId}
            counts={perKit}
            onChange={setPerKit}
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
                {`Returns ${validCount ? sumUnits(perKit) * kitCount : 0} mini bars to stock at ${locationName}`}
              </s-text>
            }
            issues={issues}
            actionLabel={`Break down ${validCount ? kitCount : ''} kit${kitCount === 1 ? '' : 's'}`.replace('  ', ' ')}
            onAction={submit}
            secondaryLabel="Print pick list"
            secondaryDisabled={!kit || pickList.rows.length === 0}
            onSecondary={() => window.print()}
          />
          <BoxPreview kit={kit} perKit={perKit} variants={variants} />
        </s-stack>
      </s-grid>
      <PickListSheet list={pickList} locationName={locationName} perKit={perKit} variants={variants} />
    </s-stack>
  );
}
