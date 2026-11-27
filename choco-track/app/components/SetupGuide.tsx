import { Fragment, useEffect, useRef, useState } from "react";
import { doneStepIds, newlyDoneSteps, nextStepId, SETUP_STEP_COUNT, type ResolvedSetup, type SetupAction, type SetupFacts, type SetupStepId } from "../domain/setup";
import { showToast } from "../lib/showToast";

interface StepCopy {
  readonly title: string;
  readonly body: string;
}

const COPY: Readonly<Record<SetupStepId, StepCopy>> = {
  products: { title: "Choose the products to watch", body: "Pick the products you want low-stock alerts for." },
  targets: { title: "Set a minimum and maximum", body: "Say how low is too low at each location. One variant is enough to start; add more any time." },
  transfers: { title: "Set up transfers (optional)", body: "Choose which locations supply stock, and how many to ship at a time, to get transfer suggestions." },
  alerts: { title: "Turn on alerts", body: "" },
};

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** What will start when alerts are turned on, so the first warning is not a surprise. */
const preview = (facts: SetupFacts): string =>
  `${plural(facts.monitoredVariants, "variant is", "variants are")} watched. ${facts.lowVariants === 1 ? "1 is" : `${facts.lowVariants} are`} low right now.`;

interface Props {
  readonly setup: ResolvedSetup;
  readonly facts: SetupFacts;
  /** The action in flight, if any. */
  readonly busy: SetupAction | undefined;
  /** A problem from the last button press, in plain words. */
  readonly error?: string;
  readonly onAddProducts: () => void;
  readonly onSetTargets: () => void;
  readonly onSkipTransfers: () => void;
  readonly onTurnOn: () => void;
  readonly onDismiss: () => void;
  /** Steps to start open (otherwise the first unfinished step is open). */
  readonly initialOpen?: readonly SetupStepId[];
  readonly initialCollapsed?: boolean;
}

/**
 * The setup guide, built the way Shopify's setup guide pattern describes: one section, steps separated by dividers,
 * progress in the header, steps ticked automatically from the data, details under each step. Only the X is withheld
 * until alerts are on, because this guide is how alerts get turned on.
 */
export function SetupGuide({ setup, facts, busy, error, onAddProducts, onSetTargets, onSkipTransfers, onTurnOn, onDismiss, initialOpen = [], initialCollapsed = false }: Props) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [override, setOverride] = useState<Readonly<Partial<Record<SetupStepId, boolean>>>>(() => Object.fromEntries(initialOpen.map((id) => [id, true])));
  const seen = useRef<readonly SetupStepId[]>(doneStepIds(setup));

  // A short toast when a step flips to done (not for steps that were already done when the page opened).
  useEffect(() => {
    for (const id of newlyDoneSteps(seen.current, setup)) showToast(`Step done: ${COPY[id].title}`);
    seen.current = doneStepIds(setup);
  }, [setup]);

  const next = nextStepId(setup);
  const isOpen = (id: SetupStepId): boolean => override[id] ?? id === next;
  const toggle = (id: SetupStepId) => setOverride((prev) => ({ ...prev, [id]: !isOpen(id) }));
  const hasProducts = facts.flaggedProducts > 0;

  const actions: Readonly<Record<SetupStepId, React.ReactNode>> = {
    products: <s-button variant="primary" onClick={onAddProducts}>Add products</s-button>,
    targets: <s-button variant="primary" disabled={!hasProducts} onClick={onSetTargets}>Set targets</s-button>,
    transfers: (
      <>
        <s-button variant="primary" href="/app/settings">Open transfer settings</s-button>
        {!setup.steps.find((s) => s.id === "transfers")?.done && (
          <s-button variant="tertiary" tone="neutral" loading={busy === "skipTransfers"} onClick={onSkipTransfers}>Skip</s-button>
        )}
      </>
    ),
    alerts: setup.complete ? null : (
      <s-button variant="primary" disabled={!setup.canTurnOn} loading={busy === "complete"} onClick={onTurnOn}>Turn on alerts</s-button>
    ),
  };

  const body = (id: SetupStepId): string => {
    if (id !== "alerts") return COPY[id].body;
    if (setup.complete) return "Alerts are on.";
    return setup.canTurnOn ? `${preview(facts)} Alerts start as soon as you turn them on.` : "Finish the first two steps to turn on alerts.";
  };

  return (
    <s-section heading="Setup guide" subheading="Finish these steps to start getting low-stock alerts.">
      <s-text slot="supplemental" color="subdued">{`${setup.doneCount} of ${SETUP_STEP_COUNT} steps completed`}</s-text>
      {setup.complete && (
        <s-button slot="secondary-actions" variant="tertiary" tone="neutral" icon="x" accessibilityLabel="Dismiss guide" loading={busy === "dismissGuide"} onClick={onDismiss} />
      )}
      <s-button
        slot="secondary-actions"
        variant="tertiary"
        tone="neutral"
        icon={collapsed ? "chevron-down" : "chevron-up"}
        accessibilityLabel="Toggle setup guide"
        onClick={() => setCollapsed((c) => !c)}
      />
      {!collapsed && (
        <s-stack gap="none">
          {error && <s-text tone="critical">{error}</s-text>}
          {setup.steps.map((step, i) => (
            <Fragment key={step.id}>
              {i > 0 && <s-divider />}
              <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingBlock="small-200">
                <s-checkbox label={COPY[step.id].title} checked={step.done} disabled />
                <s-button
                  variant="tertiary"
                  tone="neutral"
                  icon={isOpen(step.id) ? "chevron-up" : "chevron-down"}
                  accessibilityLabel={`Toggle ${COPY[step.id].title} details`}
                  onClick={() => toggle(step.id)}
                />
              </s-grid>
              {isOpen(step.id) && (
                <s-grid gap="small-200" paddingInlineStart="large-200" paddingBlockEnd="small-200">
                  <s-paragraph>{body(step.id)}</s-paragraph>
                  {actions[step.id] && (
                    <s-stack direction="inline" gap="small-200">
                      {actions[step.id]}
                    </s-stack>
                  )}
                </s-grid>
              )}
            </Fragment>
          ))}
        </s-stack>
      )}
    </s-section>
  );
}
