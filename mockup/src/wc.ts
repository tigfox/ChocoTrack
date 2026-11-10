import { useEffect, type RefObject } from 'react';

/** Value of a Polaris field element from an input/change event. */
export const fieldValue = (e: { currentTarget: unknown }): string => (e.currentTarget as { value: string }).value;

export const fieldChecked = (e: { currentTarget: unknown }): boolean => (e.currentTarget as { checked: boolean }).checked;

/** Subscribe to a custom event on a web component (React props don't cover non-standard events). */
export const useWcEvent = <T extends HTMLElement>(ref: RefObject<T | null>, type: string, handler: () => void): void => {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.addEventListener(type, handler);
    return () => el.removeEventListener(type, handler);
  }, [ref, type, handler]);
};
