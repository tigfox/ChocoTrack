import { logError } from "./logError";

describe("logError", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs name, message and context but not the error object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const err = Object.assign(new Error("boom"), { details: { token: "secret" } });
    logError("failed", err, { runId: "r1" });
    expect(spy).toHaveBeenCalledWith("failed", { runId: "r1", error: "Error: boom" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret");
  });
  it("handles non-Error values", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logError("failed", "oops");
    expect(spy).toHaveBeenCalledWith("failed", { error: "unknown" });
  });
});
