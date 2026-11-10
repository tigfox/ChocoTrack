import { useMemo, useState } from 'react';
import { INITIAL_VARIANTS, indexById, initialStock } from './data/catalog';
import type { StockMap, Variant } from './domain/types';
import { AssembleView } from './components/AssembleView';
import { DemoControls } from './components/DemoControls';
import { DisassembleView } from './components/DisassembleView';

const TABS = ['Assemble kits', 'Disassemble kits'] as const;

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
    <s-page heading="Sampler kits" inlineSize="large">
      <s-stack gap="base">
        <s-text color="subdued">Mockup - build kits from mini chocolate bar inventory</s-text>
        <s-stack direction="inline" gap="small">
          {TABS.map((label, i) => (
            <s-button key={label} variant={tab === i ? 'primary' : 'secondary'} onClick={() => setTab(i)}>
              {label}
            </s-button>
          ))}
        </s-stack>
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
      </s-stack>
    </s-page>
  );
}
