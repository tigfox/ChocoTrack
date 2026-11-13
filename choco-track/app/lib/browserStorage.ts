/** localStorage when the browser allows it (it can throw in private windows); undefined otherwise. */
export const browserStorage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};
