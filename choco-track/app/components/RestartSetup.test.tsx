import { renderToStaticMarkup } from "react-dom/server";
import { RestartSetup } from "./RestartSetup";

describe("RestartSetup", () => {
  it("does not ask for confirmation until the button is pressed", () => {
    expect(renderToStaticMarkup(<RestartSetup />)).not.toContain("Pause alerts now");
  });
  it("can start by asking to confirm, with a way back", () => {
    const html = renderToStaticMarkup(<RestartSetup initialConfirming />);
    expect(html).toContain(">Pause alerts now</s-button>");
    expect(html).toContain(">Cancel</s-button>");
  });
});
