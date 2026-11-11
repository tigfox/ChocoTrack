import { RUN_MODES } from "./runModes";

const base = { stock: { a: { L: 12 } }, perKit: { a: 3 }, locationId: "L", locationName: "Warehouse" };

describe("assemble mode", () => {
  const m = RUN_MODES.assemble;
  it("labels the action by kit count", () => {
    expect(m.actionLabel(1)).toBe("Assemble 1 kit");
    expect(m.actionLabel(3)).toBe("Assemble 3 kits");
    expect(m.actionLabel(Number.NaN)).toBe("Assemble kits");
  });
  it("describes the finished run and the picker", () => {
    expect(m.doneLabel(2, "Sampler Kit - 6 Pack")).toBe("Assembled 2 x Sampler Kit - 6 Pack");
    expect(m.pickerHeading("Kit")).toBe("Choose the mini bars in each Kit");
  });
  it("reports how many kits the mix can build", () => {
    expect(m.note({ ...base, kitCount: 1 })).toBe("Max buildable with this mix at Warehouse: 4");
  });
  it("allows creating kits and flags shortages", () => {
    expect(m.flagShortages).toBe(true);
  });
});

describe("disassemble mode", () => {
  const m = RUN_MODES.disassemble;
  it("labels the action by kit count", () => {
    expect(m.actionLabel(1)).toBe("Break down 1 kit");
    expect(m.actionLabel(2)).toBe("Break down 2 kits");
    expect(m.actionLabel(0)).toBe("Break down kits");
  });
  it("describes the finished run and the picker", () => {
    expect(m.doneLabel(2, "Kit")).toBe("Disassembled 2 x Kit");
    expect(m.pickerHeading("Kit")).toBe("Choose the mini bars in each Kit being broken down");
  });
  it("multiplies the per-kit mix by the kit count", () => {
    expect(m.note({ ...base, perKit: { a: 2, b: 4 }, kitCount: 3 })).toBe("Returns 18 mini bars to stock at Warehouse");
    expect(m.note({ ...base, kitCount: 0 })).toBe("Returns 0 mini bars to stock at Warehouse");
  });
  it("cannot create kits and does not flag shortages", () => {
    expect(m.flagShortages).toBe(false);
  });
});
