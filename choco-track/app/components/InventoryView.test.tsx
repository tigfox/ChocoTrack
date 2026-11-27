import { renderToStaticMarkup } from "react-dom/server";
import type { SetupState } from "../domain/setup";
import type { InventoryReport, ReportProduct } from "../shopify/trackedCatalog";

vi.mock("react-router", () => ({ useRevalidator: () => ({ revalidate: () => undefined, state: "idle" }) }));

const { InventoryView } = await import("./InventoryView");

const W = "gid://shopify/Location/1";
const M = "gid://shopify/Location/2";
const locations = [{ id: W, name: "Warehouse" }, { id: M, name: "Market Store" }];

const product = (targets: ReportProduct["variants"][number]["targets"]): ReportProduct => ({
  id: "p1",
  title: "Rum Caramel",
  truncated: false,
  variants: [{ id: "v1", productId: "p1", productTitle: "Rum Caramel", title: "Default Title", sku: "RUM", inventoryItemId: "i1", digest: null, targets }],
});
const LOW_TARGETS = { [M]: { min: 10, max: 30 } };
const report = (over: Partial<InventoryReport> = {}): InventoryReport => ({
  locations,
  sourceIds: [],
  packSizes: { defaultSize: 1, groups: [] },
  products: [product(LOW_TARGETS)],
  levels: { v1: { [M]: { available: 2, incoming: 0 } } },
  pending: {},
  ...over,
});
const state = (over: Partial<SetupState> = {}): SetupState => ({ completed: false, transfersSkipped: false, guideDismissed: false, ...over });
const render = (r: InventoryReport) => renderToStaticMarkup(<InventoryView report={r} collections={[]} error={undefined} />);

describe("Inventory homepage on a new install", () => {
  const html = render(report({ products: [], levels: {}, setup: state() }));
  it("shows the setup guide and no table, search or empty-state card", () => {
    expect(html).toContain('heading="Setup guide"');
    expect(html).toContain("0 of 4 steps completed");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("Product, variant or SKU");
    expect(html).not.toContain("Nothing is tracked yet");
  });
  it("shows no Suggest transfers, Edit targets or low filter", () => {
    expect(html).not.toContain("Suggest transfers");
    expect(html).not.toContain("Edit targets");
    expect(html).not.toContain("Low only");
  });
  it("is the same when nothing was ever saved and nothing is monitored", () => {
    expect(render(report({ products: [], levels: {} }))).toContain('heading="Setup guide"');
  });
});

describe("Inventory homepage while setup is unfinished but something is flagged", () => {
  const html = render(report({ setup: state() }));
  it("shows the table, with the guide above it", () => {
    expect(html).toContain("<table");
    expect(html.indexOf('heading="Setup guide"')).toBeLessThan(html.indexOf("<table"));
  });
  it("shows no alert: no low banner, badge, mark, filter, source or targets nudge, or Suggest transfers", () => {
    expect(html).not.toContain("below the minimum");
    expect(html).not.toContain("is below");
    expect(html).not.toContain('tone="critical">Low<');
    expect(html).not.toContain("inv-cell inv-low");
    expect(html).not.toContain("Low only");
    expect(html).not.toContain("No source locations set");
    expect(html).not.toContain("Suggest transfers");
  });
  it("still shows counts and targets", () => {
    expect(html).toContain("min 10 / max 30");
  });
});

describe("Inventory homepage once alerts are on", () => {
  const html = render(report({ setup: state({ completed: true }) }));
  it("shows the low banner, badges, filter and Suggest transfers", () => {
    expect(html).toContain("below the minimum");
    expect(html).toContain('tone="critical">Low<');
    expect(html).toContain("Low only");
    expect(html).toContain("Suggest transfers");
  });
  it("keeps the guide, with the X, until it is closed", () => {
    expect(html).toContain('heading="Setup guide"');
    expect(html).toContain('accessibilityLabel="Dismiss guide"');
  });
  it("drops the guide once closed", () => {
    expect(render(report({ setup: state({ completed: true, guideDismissed: true }) }))).not.toContain('heading="Setup guide"');
  });
});

describe("Inventory homepage on an install that predates the guide", () => {
  const html = render(report());
  it("behaves as before: alerts on, no guide", () => {
    expect(html).not.toContain('heading="Setup guide"');
    expect(html).toContain("below the minimum");
    expect(html).toContain("Suggest transfers");
  });
});

describe("Inventory homepage after setup is restarted on an install with targets", () => {
  it("pauses alerts and shows the guide", () => {
    const html = render(report({ setup: state() }));
    expect(html).toContain('heading="Setup guide"');
    expect(html).not.toContain("below the minimum");
  });
});
