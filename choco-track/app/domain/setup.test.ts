import {
  applySetupAction,
  doneStepIds,
  newlyDoneSteps,
  nextStepId,
  parseSetup,
  resolveSetup,
  serializeSetup,
  SETUP_STEP_COUNT,
  type SetupFacts,
  type SetupState,
} from './setup';

const NEW: SetupFacts = { flaggedProducts: 0, monitoredVariants: 0, lowVariants: 0, sourcesSaved: false };
const flagged: SetupFacts = { ...NEW, flaggedProducts: 1 };
const ready: SetupFacts = { ...NEW, flaggedProducts: 2, monitoredVariants: 3, lowVariants: 1 };
const state = (over: Partial<SetupState> = {}): SetupState => ({ completed: false, transfersSkipped: false, guideDismissed: false, ...over });

describe('parseSetup and serializeSetup', () => {
  it('round-trips a state', () => {
    const s = state({ completed: true, transfersSkipped: true });
    expect(parseSetup(serializeSetup(s))).toEqual(s);
  });
  it('treats a missing value as never set', () => {
    expect(parseSetup(undefined)).toBeUndefined();
  });
  it.each(['', 'not json', '[]', 'null', '7', '{"completed":"yes"}'])('treats %j as never set', (raw) => {
    expect(parseSetup(raw)).toBeUndefined();
  });
  it('fills missing flags with false', () => {
    expect(parseSetup('{"completed":true}')).toEqual(state({ completed: true }));
  });
});

describe('resolveSetup: a new install', () => {
  const r = resolveSetup(undefined, NEW);
  it('is not complete, so alerts are off and the guide shows', () => {
    expect(r.complete).toBe(false);
    expect(r.alertsEnabled).toBe(false);
    expect(r.showGuide).toBe(true);
    expect(r.legacy).toBe(false);
  });
  it('hides the table until a product is flagged', () => {
    expect(r.showTable).toBe(false);
    expect(resolveSetup(undefined, flagged).showTable).toBe(true);
  });
  it('lists four steps, none done', () => {
    expect(r.steps.map((s) => s.id)).toEqual(['products', 'targets', 'transfers', 'alerts']);
    expect(r.steps).toHaveLength(SETUP_STEP_COUNT);
    expect(r.doneCount).toBe(0);
    expect(r.canTurnOn).toBe(false);
  });
});

describe('resolveSetup: steps follow the data', () => {
  const done = (r: ReturnType<typeof resolveSetup>) => r.steps.filter((s) => s.done).map((s) => s.id);
  it('marks products when something is flagged', () => {
    expect(done(resolveSetup(state(), flagged))).toEqual(['products']);
  });
  it('flagged products with no targets leave Turn on alerts disabled', () => {
    expect(resolveSetup(state(), flagged).canTurnOn).toBe(false);
  });
  it('marks targets when a variant is monitored, and allows Turn on alerts', () => {
    const r = resolveSetup(state(), ready);
    expect(done(r)).toEqual(['products', 'targets']);
    expect(r.canTurnOn).toBe(true);
    expect(r.doneCount).toBe(2);
  });
  it('marks transfers done once sources are saved', () => {
    expect(done(resolveSetup(state(), { ...ready, sourcesSaved: true }))).toContain('transfers');
  });
  it('marks transfers done when skipped', () => {
    expect(done(resolveSetup(state({ transfersSkipped: true }), ready))).toContain('transfers');
  });
  it('does not need transfers for Turn on alerts', () => {
    expect(resolveSetup(state(), ready).canTurnOn).toBe(true);
  });
  it('marks every step once alerts are on', () => {
    const r = resolveSetup(state({ completed: true, transfersSkipped: true }), ready);
    expect(r.doneCount).toBe(4);
    expect(r.alertsEnabled).toBe(true);
    expect(r.canTurnOn).toBe(false);
  });
});

describe('resolveSetup: the guide after setup', () => {
  it('stays until dismissed, then goes', () => {
    expect(resolveSetup(state({ completed: true }), ready).showGuide).toBe(true);
    expect(resolveSetup(state({ completed: true, guideDismissed: true }), ready).showGuide).toBe(false);
  });
  it('always shows the table once complete, even with nothing flagged', () => {
    expect(resolveSetup(state({ completed: true }), NEW).showTable).toBe(true);
  });
  it('a dismissed flag cannot hide the guide while setup is incomplete', () => {
    expect(resolveSetup(state({ guideDismissed: true }), ready).showGuide).toBe(true);
  });
});

describe('resolveSetup: installs that predate the guide', () => {
  it('counts as complete, with no guide, when never set but something is monitored', () => {
    const r = resolveSetup(undefined, ready);
    expect(r.legacy).toBe(true);
    expect(r.complete).toBe(true);
    expect(r.alertsEnabled).toBe(true);
    expect(r.showGuide).toBe(false);
  });
  it('is not legacy once a state has been saved, so a restart is respected', () => {
    const r = resolveSetup(state(), ready);
    expect(r.legacy).toBe(false);
    expect(r.alertsEnabled).toBe(false);
  });
  it('is not legacy when nothing is monitored', () => {
    expect(resolveSetup(undefined, flagged).legacy).toBe(false);
  });
});

describe('applySetupAction', () => {
  it('turns alerts on when the data allows', () => {
    expect(applySetupAction(state(), 'complete', ready)).toEqual({ ok: true, state: state({ completed: true }) });
  });
  it.each([
    ['nothing flagged', NEW],
    ['no targets', flagged],
  ])('refuses to turn alerts on with %s', (_name, facts) => {
    const r = applySetupAction(state(), 'complete', facts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/product/i);
  });
  it('keeps the other flags when completing', () => {
    expect(applySetupAction(state({ transfersSkipped: true }), 'complete', ready)).toEqual({
      ok: true,
      state: state({ completed: true, transfersSkipped: true }),
    });
  });
  it('restarts the guide from the beginning', () => {
    expect(applySetupAction(state({ completed: true, transfersSkipped: true, guideDismissed: true }), 'restart', ready)).toEqual({
      ok: true,
      state: state(),
    });
  });
  it('restarting an install that predates the guide stores an explicit state', () => {
    expect(applySetupAction(undefined, 'restart', ready)).toEqual({ ok: true, state: state() });
  });
  it('skips the transfers step', () => {
    expect(applySetupAction(state(), 'skipTransfers', flagged)).toEqual({ ok: true, state: state({ transfersSkipped: true }) });
  });
  it('closes the guide only after setup is complete', () => {
    expect(applySetupAction(state({ completed: true }), 'dismissGuide', ready)).toEqual({
      ok: true,
      state: state({ completed: true, guideDismissed: true }),
    });
    const early = applySetupAction(state(), 'dismissGuide', ready);
    expect(early.ok).toBe(false);
  });
  it('closing the guide on a legacy install keeps it complete', () => {
    expect(applySetupAction(undefined, 'dismissGuide', ready)).toEqual({ ok: true, state: state({ completed: true, guideDismissed: true }) });
  });
});

describe('step helpers', () => {
  it('lists the ids of done steps', () => {
    expect(doneStepIds(resolveSetup(state(), ready))).toEqual(['products', 'targets']);
  });
  it('names the first step that is not done', () => {
    expect(nextStepId(resolveSetup(state(), NEW))).toBe('products');
    expect(nextStepId(resolveSetup(state(), flagged))).toBe('targets');
    expect(nextStepId(resolveSetup(state(), ready))).toBe('transfers');
    expect(nextStepId(resolveSetup(state({ transfersSkipped: true }), ready))).toBe('alerts');
  });
  it('has no next step when everything is done', () => {
    expect(nextStepId(resolveSetup(state({ completed: true, transfersSkipped: true }), ready))).toBeUndefined();
  });
  it('reports steps that became done since the last look', () => {
    const now = resolveSetup(state(), ready);
    expect(newlyDoneSteps(['products'], now)).toEqual(['targets']);
    expect(newlyDoneSteps(['products', 'targets'], now)).toEqual([]);
    expect(newlyDoneSteps([], now)).toEqual(['products', 'targets']);
  });
});
