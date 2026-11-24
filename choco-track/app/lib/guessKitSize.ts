import { kitSizeError } from '../domain/kitSize';

const COUNT_BEFORE_BARS = /(\d+)[\s-]*(?:bars?|minis?)\b/i;

/** The kit size a product name implies ("12 Bar Mini Sampler Box" gives 12), or undefined when it is missing or out of range. */
export const guessKitSize = (title: string): number | undefined => {
  const size = Number(COUNT_BEFORE_BARS.exec(title)?.[1]);
  return Number.isInteger(size) && kitSizeError(size) === undefined ? size : undefined;
};
