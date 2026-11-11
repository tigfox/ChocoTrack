import { maxBuildable, sumUnits } from "../domain/stock";
import type { StockMap, UnitCounts } from "../domain/types";
import { validateAssembly, validateDisassembly } from "../domain/validate";

export type RunMode = "assemble" | "disassemble";

export interface RunModeConfig {
  readonly mode: RunMode;
  readonly pageHeading: string;
  readonly countLabel: string;
  /** Assembly flags picker rows whose total demand exceeds stock; breaking down only adds stock. */
  readonly flagShortages: boolean;
  readonly validate: typeof validateAssembly;
  readonly pickerHeading: (kitTitle: string) => string;
  readonly actionLabel: (kitCount: number) => string;
  readonly doneLabel: (kitCount: number, kitTitle: string) => string;
  readonly note: (a: { stock: StockMap; perKit: UnitCounts; kitCount: number; locationId: string; locationName: string }) => string;
}

const plural = (n: number): string => (n === 1 ? "" : "s");
const countText = (n: number): string => (Number.isInteger(n) && n >= 1 ? `${n} ` : "");

export const RUN_MODES: Readonly<Record<RunMode, RunModeConfig>> = {
  assemble: {
    mode: "assemble",
    pageHeading: "Assemble kits",
    countLabel: "Kits to assemble",
    flagShortages: true,
    validate: validateAssembly,
    pickerHeading: (kit) => `Choose the mini bars in each ${kit}`,
    actionLabel: (n) => `Assemble ${countText(n)}kit${plural(n)}`,
    doneLabel: (n, kit) => `Assembled ${n} x ${kit}`,
    note: ({ stock, perKit, locationId, locationName }) =>
      `Max buildable with this mix at ${locationName}: ${maxBuildable(stock, perKit, locationId)}`,
  },
  disassemble: {
    mode: "disassemble",
    pageHeading: "Disassemble kits",
    countLabel: "Kits to break down",
    flagShortages: false,
    validate: validateDisassembly,
    pickerHeading: (kit) => `Choose the mini bars in each ${kit} being broken down`,
    actionLabel: (n) => `Break down ${countText(n)}kit${plural(n)}`,
    doneLabel: (n, kit) => `Disassembled ${n} x ${kit}`,
    note: ({ perKit, kitCount, locationName }) =>
      `Returns ${Number.isInteger(kitCount) && kitCount >= 1 ? sumUnits(perKit) * kitCount : 0} mini bars to stock at ${locationName}`,
  },
};
