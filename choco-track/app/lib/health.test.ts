import { checkHealth } from "./health";

describe("checkHealth", () => {
  it("is healthy when the database answers", async () => {
    await expect(checkHealth(async () => 1)).resolves.toEqual({ ok: true, status: 200, body: "ok" });
  });
  it("is unhealthy, without leaking the error, when the database fails", async () => {
    const report = await checkHealth(async () => {
      throw new Error("unable to open /data/secret-path.sqlite");
    });
    expect(report).toEqual({ ok: false, status: 503, body: "database unavailable" });
  });
});
