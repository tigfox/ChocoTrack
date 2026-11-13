import { renderToStaticMarkup } from "react-dom/server";
import { suggestTransfers } from "../domain/suggest";
import { buildReportGroups } from "../lib/reportRows";
import type { ReportProduct, ReportVariant } from "../shopify/trackedCatalog";
import { InventoryTable } from "./InventoryTable";
import { SourceLocationsCard } from "./SourceLocationsCard";
import { SuggestedTransfersModal } from "./SuggestedTransfersModal";

const W = "gid://shopify/Location/1";
const M = "gid://shopify/Location/2";
const locations = [{ id: W, name: "Warehouse" }, { id: M, name: "Market Store" }];

const variant = (id: string, title: string, targets: ReportVariant["targets"], productTitle = "Rum Caramel"): ReportVariant => ({
  id,
  productId: "p1",
  productTitle,
  title,
  sku: `SKU-${id}`,
  inventoryItemId: `i-${id}`,
  digest: null,
  targets,
});
const products: ReportProduct[] = [
  {
    id: "p1",
    title: "Rum Caramel",
    truncated: false,
    variants: [variant("mini", "Mini", { [W]: { min: 100, max: 300 }, [M]: { min: 10, max: 30 } }), variant("full", "Full", { [W]: { min: 10, max: 20 } })],
  },
  { id: "p2", title: "Haiti", truncated: false, variants: [variant("h", "Default Title", { [W]: { min: 5, max: 9 } }, "Haiti")] },
];
const levels = {
  mini: { [W]: { available: 450, incoming: 0 }, [M]: { available: 4, incoming: 0 } },
  full: { [W]: { available: 3, incoming: 20 } },
  h: { [W]: { available: 7, incoming: 0 } },
};
const groups = (pending = {}) =>
  buildReportGroups({ products, levels, pending, locationIds: [W, M], filters: { search: "", lowOnly: false, showUntargeted: false } }).groups;
const noop = () => Promise.resolve({ ok: true as const, message: "" });

describe("InventoryTable", () => {
  it("has a column per location and product rows down the left", () => {
    const html = renderToStaticMarkup(<InventoryTable groups={groups()} locations={locations} editing={false} onSave={noop} />);
    expect(html).toContain(">Warehouse</th>");
    expect(html).toContain(">Market Store</th>");
    expect(html).toContain(">Product</th>");
    expect(html).toContain("Rum Caramel");
    expect(html).toContain("SKU-mini");
  });
  it("groups variants of one product under its name and shows single-variant products directly", () => {
    const html = renderToStaticMarkup(<InventoryTable groups={groups()} locations={locations} editing={false} onSave={noop} />);
    expect(html).toContain('class="inv-group"');
    expect(html.match(/class="inv-group"/g)).toHaveLength(1); // Rum Caramel only; Haiti has one default variant
    expect(html).toContain(">Mini<");
    expect(html).toContain(">Full<");
    expect(html).toContain(">Haiti<");
  });
  it("shows count, target, status badges and what is on the way", () => {
    const html = renderToStaticMarkup(<InventoryTable groups={groups()} locations={locations} editing={false} onSave={noop} />);
    expect(html).toContain("min 100 / max 300");
    expect(html).toContain("min 10 / max 30");
    expect(html).toContain('tone="critical">Low<'); // mini at the market: 4 < 10
    expect(html).toContain("Low, restock on the way"); // full at the warehouse: 3 + 20 incoming >= 10
    expect(html).toContain("+20 incoming");
    expect(html).toContain("Over max"); // mini at the warehouse: 450 > 300
  });
  it("shows drafts that are on the way", () => {
    const html = renderToStaticMarkup(<InventoryTable groups={groups({ mini: { [M]: 8 } })} locations={locations} editing={false} onSave={noop} />);
    expect(html).toContain("+8 in draft");
    expect(html).toContain("Low, restock on the way");
  });
  it("in edit mode shows min and max fields per location and a save button per row", () => {
    const html = renderToStaticMarkup(<InventoryTable groups={groups()} locations={locations} editing onSave={noop} />);
    expect(html).toContain('label="Market Store minimum"');
    expect(html).toContain('label="Market Store maximum"');
    expect(html).toContain("Save</s-button>");
    expect(html).toContain("4 available");
  });
  it("only has columns for the locations it is given", () => {
    const only = buildReportGroups({ products, levels, pending: {}, locationIds: [W], filters: { search: "", lowOnly: false, showUntargeted: false } }).groups;
    const html = renderToStaticMarkup(<InventoryTable groups={only} locations={[locations[0] as (typeof locations)[number]]} editing={false} onSave={noop} />);
    expect(html).toContain(">Warehouse</th>");
    expect(html).not.toContain("Market Store");
  });
});

describe("SuggestedTransfersModal", () => {
  const variants = products.flatMap((p) => p.variants);
  const plan = suggestTransfers({
    variants,
    levels: { mini: { [W]: { available: 450, incoming: 0 }, [M]: { available: 4, incoming: 0 } } },
    pending: {},
    sourceIds: [W],
    locationIds: [W, M],
  });
  const render = (over: Partial<Parameters<typeof SuggestedTransfersModal>[0]> = {}) =>
    renderToStaticMarkup(
      <SuggestedTransfersModal open={false} plan={plan} locations={locations} variants={variants} hasSources onClose={() => undefined} onCreate={noop} onCreated={() => undefined} {...over} />,
    );
  it("lists each route with its lines and a way to create the draft", () => {
    const html = render();
    expect(html).toContain('heading="Warehouse to Market Store"');
    expect(html).toContain("26 x Rum Caramel - Mini");
    expect(html).toContain("Create draft in Shopify");
    expect(html).toContain("Create all (1)");
    expect(html).toContain("Nothing moves until someone reviews the draft");
  });
  it("explains when nothing is needed or no sources are set", () => {
    expect(render({ plan: { transfers: [], shortfalls: [] } })).toContain("at or above its minimum");
    const noSources = render({ plan: { transfers: [], shortfalls: [] }, hasSources: false });
    expect(noSources).toContain("No source locations set");
    expect(noSources).not.toContain("at or above its minimum");
  });
  it("names shortfalls", () => {
    const html = render({ plan: { transfers: [], shortfalls: [{ variantId: "mini", destinationId: M, quantity: 12, stillLow: true }] } });
    expect(html).toContain("Rum Caramel - Mini at Market Store: 12 short of the maximum, still below the minimum");
  });
});

describe("SourceLocationsCard", () => {
  it("shows the ordered sources and the others to add", () => {
    const html = renderToStaticMarkup(<SourceLocationsCard locations={locations} sourceIds={[W]} />);
    expect(html).toContain("1. Warehouse");
    expect(html).toContain(">Market Store</s-button>"); // an "add" button
    expect(html).toContain("Save sources");
  });
  it("drops saved ids for locations that no longer exist", () => {
    const html = renderToStaticMarkup(<SourceLocationsCard locations={locations} sourceIds={["gid://shopify/Location/99", M]} />);
    expect(html).toContain("1. Market Store");
    expect(html).not.toContain("99");
  });
  it("says so when there are none", () => {
    expect(renderToStaticMarkup(<SourceLocationsCard locations={locations} sourceIds={[]} />)).toContain("No source locations yet.");
  });
});
