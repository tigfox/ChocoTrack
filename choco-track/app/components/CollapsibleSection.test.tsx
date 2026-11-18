import { renderToStaticMarkup } from "react-dom/server";
import { CollapsibleSection } from "./CollapsibleSection";

describe("CollapsibleSection", () => {
  it("is closed by default, with the heading as its disclosure label and the content still in the page", () => {
    const html = renderToStaticMarkup(<CollapsibleSection heading="Transfer sources"><p>Inside</p></CollapsibleSection>);
    expect(html).toContain("<details");
    expect(html).not.toContain(" open");
    expect(html).toMatch(/<summary[^>]*>Transfer sources<\/summary>/);
    expect(html).toContain("<p>Inside</p>");
  });
  it("can start open", () => {
    expect(renderToStaticMarkup(<CollapsibleSection heading="H" defaultOpen>x</CollapsibleSection>)).toMatch(/<details[^>]* open/);
  });
});
