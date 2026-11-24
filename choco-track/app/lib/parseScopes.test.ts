import { describe, expect, it } from "vitest";
import { parseScopes } from "./parseScopes";

describe("parseScopes", () => {
  it("joins a list of scope strings", () => {
    expect(parseScopes({ current: ["read_products", "write_products"] })).toBe(
      "read_products,write_products",
    );
  });

  it("returns an empty string for an empty list", () => {
    expect(parseScopes({ current: [] })).toBe("");
  });

  it.each([
    ["missing", {}],
    ["null payload", null],
    ["a string", { current: "read_products" }],
    ["non-string entries", { current: ["read_products", 5] }],
    ["an object", { current: { 0: "read_products" } }],
  ])("returns null when current is %s", (_label, payload) => {
    expect(parseScopes(payload)).toBeNull();
  });
});
