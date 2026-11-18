export const MIN_KIT_SIZE = 1;
export const MAX_KIT_SIZE = 48;

const MESSAGE = `Enter a whole number from ${MIN_KIT_SIZE} to ${MAX_KIT_SIZE}.`;

/** How many mini bars a kit holds. Any whole number up to the largest box. */
export const kitSizeError = (n: unknown): string | undefined =>
  typeof n === 'number' && Number.isInteger(n) && n >= MIN_KIT_SIZE && n <= MAX_KIT_SIZE ? undefined : MESSAGE;

/** A saved size, or nothing when the stored text is not a usable number. */
export const parseKitSize = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number(raw);
  return kitSizeError(n) === undefined ? n : undefined;
};
