import type { LevelMap, PendingMap, TrackedVariant } from './tracking';

export interface SuggestInput {
  readonly variants: readonly TrackedVariant[];
  readonly levels: LevelMap;
  readonly pending: PendingMap;
  /** Locations that supply stock, in the order they are tried. Everything else is a destination. */
  readonly sourceIds: readonly string[];
  /** Every active location, in display order (destinations are served in this order). */
  readonly locationIds: readonly string[];
}

export interface TransferLine {
  readonly variantId: string;
  readonly quantity: number;
}

export interface SuggestedTransfer {
  readonly originId: string;
  readonly destinationId: string;
  readonly lines: readonly TransferLine[];
}

export interface Shortfall {
  readonly variantId: string;
  readonly destinationId: string;
  /** How much of the need to reach the maximum no source could cover. */
  readonly quantity: number;
  /** The destination is still below its minimum after the suggested transfers. */
  readonly stillLow: boolean;
}

export interface SuggestResult {
  readonly transfers: readonly SuggestedTransfer[];
  readonly shortfalls: readonly Shortfall[];
}

interface Give {
  readonly variantId: string;
  readonly originId: string;
  readonly destinationId: string;
  readonly quantity: number;
}

interface Plan {
  /** What each source can still give this variant (its available stock above its own minimum). */
  readonly surplus: Readonly<Record<string, number>>;
  readonly gives: readonly Give[];
  readonly shortfalls: readonly Shortfall[];
}

const initialSurplus = (v: TrackedVariant, levels: LevelMap, sourceIds: readonly string[]): Record<string, number> =>
  Object.fromEntries(
    sourceIds.map((id) => [id, Math.max(0, (levels[v.id]?.[id]?.available ?? 0) - (v.targets[id]?.min ?? 0))]),
  );

/** Takes `need` from the sources in order, returning what was taken and the surplus left. */
const draw = (need: number, surplus: Plan['surplus'], sourceIds: readonly string[]) =>
  sourceIds.reduce(
    (acc, originId) => {
      const take = Math.min(acc.remaining, acc.surplus[originId] ?? 0);
      return take === 0
        ? acc
        : {
            remaining: acc.remaining - take,
            surplus: { ...acc.surplus, [originId]: (acc.surplus[originId] ?? 0) - take },
            taken: [...acc.taken, { originId, quantity: take }],
          };
    },
    { remaining: need, surplus, taken: [] as ReadonlyArray<{ originId: string; quantity: number }> },
  );

const planVariant = (v: TrackedVariant, input: SuggestInput, destinations: readonly string[]): Plan =>
  destinations.reduce<Plan>(
    (plan, destinationId) => {
      const target = v.targets[destinationId];
      if (!target) return plan;
      const have =
        (input.levels[v.id]?.[destinationId]?.available ?? 0) +
        (input.levels[v.id]?.[destinationId]?.incoming ?? 0) +
        (input.pending[v.id]?.[destinationId] ?? 0);
      if (have >= target.min) return plan;
      const drawn = draw(target.max - have, plan.surplus, input.sourceIds);
      const received = target.max - have - drawn.remaining;
      return {
        surplus: drawn.surplus,
        gives: [...plan.gives, ...drawn.taken.map((t) => ({ variantId: v.id, destinationId, ...t }))],
        shortfalls:
          drawn.remaining > 0
            ? [...plan.shortfalls, { variantId: v.id, destinationId, quantity: drawn.remaining, stillLow: have + received < target.min }]
            : plan.shortfalls,
      };
    },
    { surplus: initialSurplus(v, input.levels, input.sourceIds), gives: [], shortfalls: [] },
  );

/**
 * Suggests transfers that bring every destination below its minimum back up to its maximum.
 * Stock already incoming or in draft transfers counts. A source never gives more than it has above its own
 * minimum (a source with no target can give all of it). Whatever sources cannot cover is reported as a shortfall.
 */
export const suggestTransfers = (input: SuggestInput): SuggestResult => {
  const destinations = input.locationIds.filter((id) => !input.sourceIds.includes(id));
  const plans = input.variants.map((v) => planVariant(v, input, destinations));
  const gives = plans.flatMap((p) => p.gives);
  const transfers = input.sourceIds.flatMap((originId) =>
    destinations.flatMap((destinationId): SuggestedTransfer[] => {
      const lines = gives
        .filter((g) => g.originId === originId && g.destinationId === destinationId)
        .map(({ variantId, quantity }) => ({ variantId, quantity }));
      return lines.length > 0 ? [{ originId, destinationId, lines }] : [];
    }),
  );
  return { transfers, shortfalls: plans.flatMap((p) => p.shortfalls) };
};
