import { renderToStaticMarkup } from "react-dom/server";
import { resolveSetup, type SetupFacts, type SetupState } from "../domain/setup";
import { SetupGuide } from "./SetupGuide";

const NEW: SetupFacts = { flaggedProducts: 0, monitoredVariants: 0, lowVariants: 0, sourcesSaved: false };
const flagged: SetupFacts = { ...NEW, flaggedProducts: 2 };
const ready: SetupFacts = { ...NEW, flaggedProducts: 2, monitoredVariants: 3, lowVariants: 1 };
const state = (over: Partial<SetupState> = {}): SetupState => ({ completed: false, transfersSkipped: false, guideDismissed: false, ...over });
const noop = () => undefined;

const render = (facts: SetupFacts, stored: SetupState | undefined, extra: Partial<Parameters<typeof SetupGuide>[0]> = {}) =>
  renderToStaticMarkup(
    <SetupGuide setup={resolveSetup(stored, facts)} facts={facts} busy={undefined} onAddProducts={noop} onSetTargets={noop} onSkipTransfers={noop} onTurnOn={noop} onDismiss={noop} {...extra} />,
  );

describe("SetupGuide structure (Shopify setup guide pattern)", () => {
  it("is one section headed Setup guide, with progress in the supplemental slot", () => {
    const html = render(flagged, state());
    expect(html).toContain('heading="Setup guide"');
    expect(html).toContain('slot="supplemental"');
    expect(html).toContain("1 of 4 steps completed");
  });
  it("lists the four steps, each as a read-only checkbox that reflects the data", () => {
    const html = render(ready, state());
    for (const label of ["Choose the products to watch", "Set a minimum and maximum", "Set up transfers (optional)", "Turn on alerts"]) {
      expect(html).toContain(`label="${label}"`);
    }
    expect(html.match(/<s-checkbox/g)).toHaveLength(4);
    expect(html.match(/<s-checkbox[^>]*checked/g)).toHaveLength(2);
    expect(html.match(/<s-checkbox[^>]*disabled/g)).toHaveLength(4);
  });
  it("separates steps with dividers and gives every icon-only button an accessibility label", () => {
    const html = render(ready, state());
    expect(html.match(/<s-divider/g)).toHaveLength(3);
    expect(html).toContain('accessibilityLabel="Toggle setup guide"');
    expect(html).toContain('accessibilityLabel="Toggle Turn on alerts details"');
    for (const button of html.match(/<s-button[^>]*icon="[^"]+"[^>]*>/g) ?? []) expect(button).toContain("accessibilityLabel=");
  });
  it("uses tertiary neutral icon buttons for toggles", () => {
    const html = render(flagged, state());
    expect(html).toMatch(/<s-button[^>]*variant="tertiary"[^>]*tone="neutral"[^>]*icon="chevron-(up|down)"/);
  });
});

describe("SetupGuide dismissal", () => {
  it("cannot be dismissed while setup is unfinished, because it is how alerts get turned on", () => {
    expect(render(ready, state())).not.toContain("Dismiss guide");
  });
  it("can be dismissed with the X once alerts are on", () => {
    const html = render(ready, state({ completed: true }));
    expect(html).toContain('accessibilityLabel="Dismiss guide"');
    expect(html).toContain('icon="x"');
    expect(html).toContain('slot="secondary-actions"');
  });
});

describe("SetupGuide steps", () => {
  it("opens the first unfinished step, with a primary action", () => {
    const html = render(NEW, state());
    expect(html).toContain(">Add products</s-button>");
    expect(html).not.toContain("Set targets");
    expect(html).not.toContain("Turn on alerts</s-button>");
  });
  it("moves on to the targets step once products are flagged", () => {
    const html = render(flagged, state());
    expect(html).toContain(">Set targets</s-button>");
    expect(html).not.toContain(">Add products</s-button>");
  });
  it("offers Skip next to the transfer settings link, and nothing after it is done", () => {
    const html = render(ready, state());
    expect(html).toContain('href="/app/settings"');
    expect(html).toContain(">Open transfer settings</s-button>");
    expect(html).toContain(">Skip</s-button>");
  });
  it("shows Turn on alerts last, with a preview of what will start, and enables it when allowed", () => {
    const html = render(ready, state({ transfersSkipped: true }));
    expect(html).toContain("3 variants are watched. 1 is low right now.");
    expect(html).toMatch(/<s-button[^>]*variant="primary"(?![^>]*disabled)[^>]*>Turn on alerts<\/s-button>/);
  });
  it("disables Turn on alerts until products and targets are done", () => {
    const html = render(flagged, state({ transfersSkipped: true }), { initialOpen: ["alerts"] });
    expect(html).toMatch(/<s-button[^>]*disabled[^>]*>Turn on alerts<\/s-button>/);
    expect(html).toContain("Finish the first two steps");
  });
  it("says alerts are on when setup is complete", () => {
    expect(render(ready, state({ completed: true }), { initialOpen: ["alerts"] })).toContain("Alerts are on.");
  });
  it("shows a problem in the step, in plain words", () => {
    expect(render(ready, state({ transfersSkipped: true }), { error: "Could not save." })).toContain("Could not save.");
  });
  it("can be collapsed to its header", () => {
    const html = render(ready, state(), { initialCollapsed: true });
    expect(html).toContain("2 of 4 steps completed");
    expect(html).not.toContain("<s-checkbox");
  });
});
