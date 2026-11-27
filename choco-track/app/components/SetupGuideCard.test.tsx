import { renderToStaticMarkup } from "react-dom/server";
import { SetupGuideCard } from "./SetupGuideCard";

describe("SetupGuideCard", () => {
  it("explains that restarting pauses alerts, and offers one button", () => {
    const html = renderToStaticMarkup(<SetupGuideCard />);
    expect(html).toContain("Setup guide");
    expect(html).toContain("Alerts stay off until you finish");
    expect(html).toContain(">Pause alerts and restart setup</s-button>");
  });
  it("does not ask for confirmation until the button is pressed", () => {
    expect(renderToStaticMarkup(<SetupGuideCard />)).not.toContain("Pause alerts now");
  });
  it("can start by asking to confirm", () => {
    const html = renderToStaticMarkup(<SetupGuideCard initialConfirming />);
    expect(html).toContain(">Pause alerts now</s-button>");
    expect(html).toContain(">Cancel</s-button>");
  });
});
