import { parseSearchParams } from "./searchParams";

const parse = (qs: string) => parseSearchParams(new URLSearchParams(qs));

describe("parseSearchParams", () => {
  it("defaults to an empty search of 50", () => {
    expect(parse("")).toEqual({ text: "", first: 50 });
  });
  it("reads text, a valid collection and a limit", () => {
    expect(parse("q=rum&collection=gid://shopify/Collection/42&limit=100")).toEqual({
      text: "rum",
      first: 100,
      collectionId: "gid://shopify/Collection/42",
    });
  });
  it("ignores a malformed collection id", () => {
    expect(parse("collection=nope").collectionId).toBeUndefined();
    expect(parse("collection=gid://shopify/Product/1").collectionId).toBeUndefined();
  });
  it("caps the text length", () => {
    expect(parse(`q=${"x".repeat(500)}`).text).toHaveLength(100);
  });
  it.each([
    ["10000", 250],
    ["0", 50],
    ["-5", 50],
    ["abc", 50],
    ["1.5", 50],
  ])("limits %s to %i", (limit, expected) => {
    expect(parse(`limit=${limit}`).first).toBe(expected);
  });
});
