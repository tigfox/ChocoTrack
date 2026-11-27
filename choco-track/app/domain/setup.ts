/**
 * The inventory setup guide: what is done, whether alerts may show, and what each button may do.
 * Pure (no Shopify imports). `resolveSetup(...).alertsEnabled` is the ONE answer every alert surface asks:
 * the sidebar count, the low banner, low badges, Suggest transfers. Do not re-derive it elsewhere.
 */

/** What is stored with the app installation. Everything else is worked out from Shopify data. */
export interface SetupState {
  /** The person pressed Turn on alerts. */
  readonly completed: boolean;
  /** The optional transfers step was skipped. */
  readonly transfersSkipped: boolean;
  /** The finished guide was closed. Ignored until setup is complete. */
  readonly guideDismissed: boolean;
}

/** `undefined` means it was never saved: a new install, or one that predates the guide. */
export type StoredSetup = SetupState | undefined;

/** What the guide reads from the report to tick steps off. */
export interface SetupFacts {
  /** Products flagged for the report. */
  readonly flaggedProducts: number;
  /** Variants with targets that are not switched off. */
  readonly monitoredVariants: number;
  /** Monitored variants below a minimum right now (for the preview on the last step). */
  readonly lowVariants: number;
  /** At least one transfer source location is saved. */
  readonly sourcesSaved: boolean;
}

export type SetupStepId = 'products' | 'targets' | 'transfers' | 'alerts';

export interface SetupStep {
  readonly id: SetupStepId;
  readonly done: boolean;
}

export interface ResolvedSetup {
  /** The state in force: the stored one, or the implied one for an install that predates the guide. */
  readonly state: SetupState;
  /** Never saved, but already monitoring variants, so treated as set up. */
  readonly legacy: boolean;
  readonly complete: boolean;
  readonly alertsEnabled: boolean;
  readonly steps: readonly SetupStep[];
  readonly doneCount: number;
  /** Turn on alerts is allowed: something is flagged and something has targets. */
  readonly canTurnOn: boolean;
  readonly showGuide: boolean;
  /** The table is hidden until a product is flagged, unless setup is complete. */
  readonly showTable: boolean;
}

export const SETUP_STEP_COUNT = 4;

const DEFAULT_STATE: SetupState = { completed: false, transfersSkipped: false, guideDismissed: false };
/** An install that predates the guide: set up, and no guide to nag about. */
const LEGACY_STATE: SetupState = { completed: true, transfersSkipped: false, guideDismissed: true };

export const parseSetup = (raw: string | undefined): StoredSetup => {
  if (raw === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
    const p = parsed as Record<string, unknown>;
    if (typeof p.completed !== 'boolean') return undefined;
    return { completed: p.completed, transfersSkipped: p.transfersSkipped === true, guideDismissed: p.guideDismissed === true };
  } catch {
    return undefined;
  }
};

export const serializeSetup = (state: SetupState): string =>
  JSON.stringify({ completed: state.completed, transfersSkipped: state.transfersSkipped, guideDismissed: state.guideDismissed });

export const resolveSetup = (stored: StoredSetup, facts: SetupFacts): ResolvedSetup => {
  const legacy = stored === undefined && facts.monitoredVariants > 0;
  const state = stored ?? (legacy ? LEGACY_STATE : DEFAULT_STATE);
  const complete = state.completed;
  const hasProducts = facts.flaggedProducts > 0;
  const hasTargets = facts.monitoredVariants > 0;
  const steps: readonly SetupStep[] = [
    { id: 'products', done: hasProducts },
    { id: 'targets', done: hasTargets },
    { id: 'transfers', done: facts.sourcesSaved || state.transfersSkipped },
    { id: 'alerts', done: complete },
  ];
  return {
    state,
    legacy,
    complete,
    alertsEnabled: complete,
    steps,
    doneCount: steps.filter((s) => s.done).length,
    canTurnOn: !complete && hasProducts && hasTargets,
    showGuide: !complete || !state.guideDismissed,
    showTable: complete || hasProducts,
  };
};

export type SetupAction = 'complete' | 'restart' | 'skipTransfers' | 'dismissGuide';

export const SETUP_ACTIONS: readonly SetupAction[] = ['complete', 'restart', 'skipTransfers', 'dismissGuide'];

export type SetupResult = { readonly ok: true; readonly state: SetupState } | { readonly ok: false; readonly error: string };

/** The state after a button press, or why it is refused. The server runs this on fresh Shopify data. */
export const applySetupAction = (stored: StoredSetup, action: SetupAction, facts: SetupFacts): SetupResult => {
  const current = resolveSetup(stored, facts);
  switch (action) {
    case 'complete':
      return current.canTurnOn
        ? { ok: true, state: { ...current.state, completed: true } }
        : { ok: false, error: 'Choose a product to watch and set a minimum and maximum before turning on alerts.' };
    case 'restart':
      return { ok: true, state: DEFAULT_STATE };
    case 'skipTransfers':
      return { ok: true, state: { ...current.state, transfersSkipped: true } };
    case 'dismissGuide':
      return current.complete
        ? { ok: true, state: { ...current.state, guideDismissed: true } }
        : { ok: false, error: 'Finish setup before closing the guide.' };
  }
};

export const doneStepIds = (setup: ResolvedSetup): readonly SetupStepId[] => setup.steps.filter((s) => s.done).map((s) => s.id);

/** The first step that is not done, or undefined when all are. */
export const nextStepId = (setup: ResolvedSetup): SetupStepId | undefined => setup.steps.find((s) => !s.done)?.id;

/** Steps that are done now but were not in `before`: the guide shows a short toast for each. */
export const newlyDoneSteps = (before: readonly SetupStepId[], setup: ResolvedSetup): readonly SetupStepId[] =>
  doneStepIds(setup).filter((id) => !before.includes(id));
