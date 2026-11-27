import { renderToStaticMarkup } from "react-dom/server";
import { SetupSettingsCard } from "./SetupSettingsCard";

describe("SetupSettingsCard (restart and reset in one card)", () => {
  const html = renderToStaticMarkup(<SetupSettingsCard />);

  it("is one folded card holding both actions, with a divider between them", () => {
    expect(html.match(/<summary/g)).toHaveLength(1);
    expect(html).toContain("Setup guide and reset");
    expect(html).toContain("Restart the setup guide");
    expect(html).toContain(">Reset all settings</s-heading>");
    expect(html.match(/<s-divider/g)).toHaveLength(1);
  });
  it("restart is a plain button that asks first, and says what is kept", () => {
    expect(html).toContain(">Pause alerts and restart setup</s-button>");
    expect(html).toContain("Alerts stay off until you finish it");
    expect(html).not.toContain("Pause alerts now");
  });
  it("reset has a critical trigger and explains what it does", () => {
    expect(html).toMatch(/<s-button[^>]*tone="critical"[^>]*>Reset all settings<\/s-button>/);
    expect(html).toContain("restarts the setup guide");
  });
  it("confirms a reset in a modal that names the consequences, as Shopify's guidance asks", () => {
    expect(html).toContain('heading="Reset all settings?"');
    expect(html).toContain("tracked products");
    expect(html).toContain("minimum and maximum targets");
    expect(html).toContain("transfer sources and pack sizes");
    expect(html).toContain("not changed");
    expect(html).toContain("This action cannot be undone.");
  });
  it("uses a critical primary action and a Cancel secondary action with specific labels", () => {
    expect(html).toMatch(/<s-button[^>]*slot="primary-action"[^>]*>Reset all settings<\/s-button>/);
    expect(html).toMatch(/<s-button[^>]*slot="secondary-actions"[^>]*>Cancel<\/s-button>/);
  });
});
