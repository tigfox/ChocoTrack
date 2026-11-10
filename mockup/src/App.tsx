import { useMemo, useState } from 'react';
import { BlockStack, Page, Tabs } from '@shopify/polaris';
import { INITIAL_VARIANTS, indexById, initialStock } from './data/catalog';
import type { StockMap, Variant } from './domain/types';
import { AssembleView } from './components/AssembleView';
import { DemoControls } from './components/DemoControls';
import { DisassembleView } from './components/DisassembleView';

const TABS = [
  { id: 'assemble', content: 'Assemble kits', panelID: 'assemble-panel' },
  { id: 'disassemble', content: 'Disassemble kits', panelID: 'disassemble-panel' },
];

export function App() {
  const [tab, setTab] = useState(0);
  const [stock, setStock] = useState<StockMap>(initialStock);
  const [variants, setVariants] = useState<readonly Variant[]>(INITIAL_VARIANTS);
  const [simulateConflict, setSimulateConflict] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const state = useMemo(() => ({ stock, variantsById: indexById(variants) }), [stock, variants]);

  const reset = () => {
    setStock(initialStock());
    setVariants(INITIAL_VARIANTS);
    setSimulateConflict(false);
    setResetKey((k) => k + 1);
  };

  return (
    <Page title="Sampler kits" subtitle="Mockup - build kits from mini chocolate bar inventory">
      <BlockStack gap="400">
        <Tabs tabs={TABS} selected={tab} onSelect={setTab} />
        {tab === 0 ? (
          <AssembleView
            key={`a-${resetKey}`}
            state={state}
            variants={variants}
            simulateConflict={simulateConflict}
            onStockChange={setStock}
            onCreateKit={(k) => setVariants((vs) => [...vs, k])}
          />
        ) : (
          <DisassembleView
            key={`d-${resetKey}`}
            state={state}
            variants={variants}
            simulateConflict={simulateConflict}
            onStockChange={setStock}
          />
        )}
        <DemoControls simulateConflict={simulateConflict} onSimulateConflict={setSimulateConflict} onReset={reset} />
      </BlockStack>
    </Page>
  );
}
