import { notifyAlertsChanged, onAlertsChanged } from './alertsChanged';

describe('alertsChanged (in a browser)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', new EventTarget());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tells subscribers when alerts were turned on or paused', () => {
    const seen = vi.fn();
    const stop = onAlertsChanged(seen);
    notifyAlertsChanged();
    notifyAlertsChanged();
    expect(seen).toHaveBeenCalledTimes(2);
    stop();
  });
  it('stops telling a subscriber that unsubscribed', () => {
    const seen = vi.fn();
    onAlertsChanged(seen)();
    notifyAlertsChanged();
    expect(seen).not.toHaveBeenCalled();
  });
});

describe('alertsChanged (on the server)', () => {
  it('does nothing without a window', () => {
    expect(() => notifyAlertsChanged()).not.toThrow();
    expect(() => onAlertsChanged(() => undefined)()).not.toThrow();
  });
});
