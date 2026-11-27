const EVENT = 'choco-track:alerts-changed';

/** Alerts were turned on or paused: the sidebar should look again instead of waiting for the next page. */
export const notifyAlertsChanged = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EVENT));
};

/** Subscribes; returns the function that stops listening. */
export const onAlertsChanged = (handler: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};
