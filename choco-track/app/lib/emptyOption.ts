/** The value used for a "no selection" option; s-select reports an option with an empty value by its label instead. */
export const NO_OPTION = 'none';

export const toOptionValue = (value: string): string => (value === '' ? NO_OPTION : value);
export const fromOptionValue = (value: string): string => (value === NO_OPTION ? '' : value);
