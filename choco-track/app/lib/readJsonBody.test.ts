import { readJsonBody } from "./readJsonBody";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://x.test/", { method: "POST", body, headers });

describe("readJsonBody", () => {
  it("parses valid JSON", async () => {
    await expect(readJsonBody(post('{"a":1}'))).resolves.toEqual({ a: 1 });
  });
  it.each([["malformed", "{nope"], ["empty", ""]])("returns null for %s bodies", async (_n, body) => {
    await expect(readJsonBody(post(body))).resolves.toBeNull();
  });
  it("rejects a declared oversized body without reading it", async () => {
    await expect(readJsonBody(post("{}", { "content-length": "999999" }), 100)).resolves.toBeNull();
  });
  it("rejects an oversized body that under-declares its length", async () => {
    await expect(readJsonBody(post(JSON.stringify({ a: "x".repeat(200) })), 100)).resolves.toBeNull();
  });
});
