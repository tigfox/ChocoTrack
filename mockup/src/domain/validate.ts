import { availableAt, positiveEntries, sumUnits } from './stock';
import type { StockMap, UnitCounts, ValidationIssue, Variant } from './types';

interface Common {
  readonly stock: StockMap;
  readonly variantsById: Readonly<Record<string, Variant>>;
  readonly locationId: string;
  readonly kit: Variant | undefined;
  readonly kitCount: number;
}

export interface AssemblyInput extends Common {
  readonly perKit: UnitCounts;
}

export interface DisassemblyInput extends Common {
  /** Mini bars in ONE kit being broken down; returned stock is this x kitCount. */
  readonly perKit: UnitCounts;
}

const issue = (code: ValidationIssue['code'], message: string, variantId?: string): ValidationIssue =>
  variantId === undefined ? { code, message } : { code, message, variantId };

const nameOf = (byId: Common['variantsById'], id: string): string => byId[id]?.title ?? id;

const baseIssues = ({ locationId, kit, kitCount }: Common): ValidationIssue[] => [
  ...(locationId ? [] : [issue('NO_LOCATION', 'Choose a location.')]),
  ...(kit ? [] : [issue('NO_KIT', 'Choose a kit.')]),
  ...(Number.isInteger(kitCount) && kitCount >= 1
    ? []
    : [issue('BAD_KIT_COUNT', 'Number of kits must be a whole number of at least 1.')]),
];

const quantityIssues = (counts: UnitCounts, byId: Common['variantsById']): ValidationIssue[] =>
  Object.entries(counts)
    .filter(([, n]) => !Number.isInteger(n) || n < 0)
    .map(([id]) => issue('INVALID_QUANTITY', `${nameOf(byId, id)} needs a whole number of 0 or more.`, id));

const totalIssues = (counts: UnitCounts, expected: number, label: string): ValidationIssue[] => {
  const total = sumUnits(counts);
  if (total === 0) return [issue('NO_UNITS', 'Add at least one mini bar.')];
  return total === expected
    ? []
    : [issue('WRONG_UNIT_TOTAL', `${label} needs exactly ${expected} mini bars; you have ${total} of ${expected}.`)];
};

const notStocked = (c: Common, id: string): ValidationIssue =>
  issue('NOT_STOCKED', `${nameOf(c.variantsById, id)} isn't stocked at this location.`, id);

export const validateAssembly = (input: AssemblyInput): readonly ValidationIssue[] => {
  const base = baseIssues(input);
  const { kit, kitCount, perKit, stock, locationId, variantsById } = input;
  const quantity = quantityIssues(perKit, variantsById);
  const total = kit?.kitSize === undefined ? [] : totalIssues(perKit, kit.kitSize, 'Each kit');
  const canCheckStock = locationId !== '' && Number.isInteger(kitCount) && kitCount >= 1 && quantity.length === 0;
  const stockIssues = canCheckStock
    ? positiveEntries(perKit).flatMap(([id, perKitQty]): ValidationIssue[] => {
        const available = availableAt(stock, id, locationId);
        if (available === null) return [notStocked(input, id)];
        const needed = perKitQty * kitCount;
        return needed > available
          ? [issue('INSUFFICIENT_STOCK', `Only ${available} ${nameOf(variantsById, id)} available; ${needed} needed.`, id)]
          : [];
      })
    : [];
  return [...base, ...quantity, ...total, ...stockIssues];
};

export const validateDisassembly = (input: DisassemblyInput): readonly ValidationIssue[] => {
  const base = baseIssues(input);
  const { kit, kitCount, perKit, stock, locationId, variantsById } = input;
  const quantity = quantityIssues(perKit, variantsById);
  const validCount = Number.isInteger(kitCount) && kitCount >= 1;
  const total = kit?.kitSize === undefined ? [] : totalIssues(perKit, kit.kitSize, 'Each kit');
  const kitAvailable = kit && locationId ? (availableAt(stock, kit.id, locationId) ?? 0) : 0;
  const kitStock =
    kit && locationId && validCount && kitCount > kitAvailable
      ? [issue('INSUFFICIENT_STOCK', `Only ${kitAvailable} ${kit.title} available here; ${kitCount} to break down.`, kit.id)]
      : [];
  const stockIssues = locationId
    ? positiveEntries(perKit)
        .filter(([id]) => availableAt(stock, id, locationId) === null)
        .map(([id]) => notStocked(input, id))
    : [];
  return [...base, ...quantity, ...total, ...kitStock, ...stockIssues];
};
