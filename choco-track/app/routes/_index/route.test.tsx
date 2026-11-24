import { renderToStaticMarkup } from "react-dom/server";
import Index, { loader } from "./route";

const call = (url: string) => loader({ request: new Request(url), params: {}, context: {} } as never);

describe("public index page", () => {
  it("renders no text at all", () => {
    const text = renderToStaticMarkup(<Index />).replace(/<[^>]*>/g, "").trim();
    expect(text).toBe("");
  });

  it("has no form, link or input to interact with", () => {
    expect(renderToStaticMarkup(<Index />)).not.toMatch(/<(form|input|button|a|h1|p|ul)\b/);
  });

  it("still forwards Shopify's ?shop= visits into the app", async () => {
    const thrown = await call("https://x.test/?shop=a.myshopify.com").catch((r: Response) => r);
    expect((thrown as Response).status).toBe(302);
    expect((thrown as Response).headers.get("location")).toBe("/app?shop=a.myshopify.com");
  });

  it("returns nothing for a plain visit", async () => {
    expect(await call("https://x.test/")).toBeNull();
  });
});
