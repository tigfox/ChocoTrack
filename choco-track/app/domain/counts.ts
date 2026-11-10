import type { UnitCounts } from './types';

/** Returns new counts with `id` set to `n`; zero (or NaN) removes the entry. Non-integers are kept so validation can flag them. */
export const withCount = (counts: UnitCounts, id: string, n: number): UnitCounts => {
  const { [id]: _removed, ...rest } = counts;
  return Number.isNaN(n) || n === 0 ? rest : { ...rest, [id]: n };
};

export const parseCount = (raw: string): number => (raw.trim() === '' ? 0 : Number(raw));
