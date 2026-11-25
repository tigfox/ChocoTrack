import { renderToStaticMarkup } from "react-dom/server";
import { suggestTransfers } from "../domain/suggest";
import { buildReportGroups } from "../lib/reportRows";
import type { ReportProduct, ReportVariant } from "../shopify/trackedCatalog";
import { InventoryTable } from "./InventoryTable";
import { CreatedTransferLinks } from "./CreatedTransferLinks";
import { KitSettingsView } from "./KitSettingsView";
import { PackSizeCard } from "./PackSizeCard";
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
  it("says when a line was rounded up past the maximum to keep the minimum", () => {
    const rounded = { transfers: [{ originId: W, destinationId: M, lines: [{ variantId: "mini", quantity: 100, overMax: true as const }] }], shortfalls: [] };
    const html = render({ plan: rounded });
    expect(html).toContain("100 x Rum Caramel - Mini");
    expect(html).toContain("rounded up to a full box so Market Store stays at its minimum");
    expect(render()).not.toContain("rounded up");
  });
  it("tells people quantities follow the pack sizes from Settings", () => {
    expect(render()).toContain("Quantities follow the pack sizes on the Settings page");
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

describe("CreatedTransferLinks", () => {
  const created = [
    { id: "gid://shopify/InventoryTransfer/11", originId: W, destinationId: M, lines: [{ variantId: "mini", quantity: 100 }] },
    { id: "not-a-transfer-id", originId: M, destinationId: W, lines: [{ variantId: "mini", quantity: 5 }] },
  ];
  it("links each created draft to its page in the Shopify admin, opening in a new tab", () => {
    const html = renderToStaticMarkup(<CreatedTransferLinks created={created} locations={locations} shopHandle="choco-dev" />);
    expect(html).toContain('href="https://admin.shopify.com/store/choco-dev/transfers/11"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Open draft: Warehouse to Market Store");
  });
  it("shows a bad id as plain text with no link, and links to the Transfers list", () => {
    const html = renderToStaticMarkup(<CreatedTransferLinks created={created} locations={locations} shopHandle="choco-dev" />);
    expect(html).toContain("Market Store to Warehouse");
    expect(html.match(/transfers\/11/g)).toHaveLength(1);
    expect(html).toContain('href="https://admin.shopify.com/store/choco-dev/transfers"');
  });
  it("shows no links at all when the store is unknown, and nothing when none were created", () => {
    expect(renderToStaticMarkup(<CreatedTransferLinks created={created} locations={locations} shopHandle={undefined} />)).not.toContain("href=");
    expect(renderToStaticMarkup(<CreatedTransferLinks created={[]} locations={locations} shopHandle="choco-dev" />)).toBe("");
  });
});

describe("PackSizeCard", () => {
  const V1 = "gid://shopify/ProductVariant/1";
  const V2 = "gid://shopify/ProductVariant/2";
  const V3 = "gid://shopify/ProductVariant/3";
  const packSizes = { defaultSize: 1, groups: [{ size: 5, variantIds: [V1] }, { size: 100, variantIds: [V2, V3] }] };
  const labels = {
    [V1]: { title: "Rum Caramel - 60g Bar", sku: "BAR-RUM" },
    [V2]: { title: "Bolivia 72%", sku: "MIN-BOL-RAR", group: "Rare" },
  };
  const html = renderToStaticMarkup(<PackSizeCard packSizes={packSizes} labels={labels} collections={[]} />);
  it("is headed Pack Size, with the default and each group's size", () => {
    expect(html).toContain(">Pack Size</summary>");
    expect(html).not.toContain("Send in multiples of");
    expect(html).toContain('label="Default pack size"');
    expect(html).toContain('value="1"');
    expect(html).toContain('label="Pack size, group 1"');
    expect(html).toContain('value="5"');
    expect(html).toContain('label="Pack size, group 2"');
    expect(html).toContain('value="100"');
  });
  it("lists the variants in each group by name, with the category and SKU", () => {
    expect(html).toContain("Rum Caramel - 60g Bar");
    expect(html).toContain("BAR-RUM");
    expect(html).toContain("Bolivia 72%");
    expect(html).toContain("Rare - MIN-BOL-RAR");
    expect(html).toContain("1 variant<");
    expect(html).toContain("2 variants<");
  });
  it("says so when a listed variant no longer exists", () => {
    expect(html).toContain("A variant that was deleted");
  });
  it("offers adding products, adding a group and saving", () => {
    expect(html).toContain("Add products");
    expect(html).toContain("Add a pack size group");
    expect(html).toContain("Save pack sizes");
    expect(html).toContain("Remove group");
  });
  it("starts folded away, and explains the empty case", () => {
    expect(html).toContain("<details");
    expect(html).not.toContain(" open");
    const empty = renderToStaticMarkup(<PackSizeCard packSizes={{ defaultSize: 1, groups: [] }} labels={{}} collections={[]} />);
    expect(empty).toContain("No groups: every variant uses the default.");
    expect(renderToStaticMarkup(<SourceLocationsCard locations={locations} sourceIds={[]} />)).toMatch(/<details(?![^>]* open)/);
  });
});

vi.mock("../hooks/useSettingsAction", () => ({ useSettingsAction: () => ({ busy: false, response: undefined, submit: () => Promise.resolve() }) }));

describe("KitSettingsView", () => {
  const kit = (id: string, title: string, kitSize: number) => ({ id, title, sku: `S${kitSize}`, kitSize, inventoryItemId: `i${id}`, productId: "p", price: "1.00" }) as never;
  const workspace = { locations, collections: [], kits: [kit("a", "Sampler 6", 6), kit("b", "Sampler 8", 8)], stock: {} };
  const html = renderToStaticMarkup(<KitSettingsView workspace={workspace} sourceIds={[]} packSizes={{ defaultSize: 1, groups: [] }} labels={{}} />);
  it("folds every kit behind one closed Sampler Kits section", () => {
    expect(html).toContain(">Sampler Kits</summary>");
    expect(html.match(/>Sampler Kits<\/summary>/g)).toHaveLength(1);
    expect(html).toContain('heading="Sampler 6"');
    expect(html).toContain('heading="Sampler 8"');
    expect(html.indexOf("Sampler Kits</summary>")).toBeLessThan(html.indexOf('heading="Sampler 6"'));
    expect(html.indexOf('heading="Sampler 8"')).toBeLessThan(html.indexOf("Transfer sources"));
  });
  it("titles the page ChocoTrack Settings and keeps Create a new kit inside the Sampler Kits section, not in the page header", () => {
    expect(html).toContain('heading="ChocoTrack Settings"');
    expect(html).not.toContain("Kit settings");
    expect(html.slice(0, html.indexOf(">Sampler Kits</summary>"))).not.toContain("Create a new kit");
    const button = html.indexOf(">Create a new kit</s-button>");
    expect(button).toBeGreaterThan(html.indexOf(">Sampler Kits</summary>"));
    expect(button).toBeLessThan(html.indexOf("Transfer sources"));
  });
  it("opens the section with a warning when there are no kits, so the button is in reach", () => {
    const empty = renderToStaticMarkup(<KitSettingsView workspace={{ ...workspace, kits: [] }} sourceIds={[]} packSizes={{ defaultSize: 1, groups: [] }} labels={{}} />);
    expect(empty).toMatch(/<details[^>]* open/);
    expect(empty).toContain("No kits yet");
    expect(empty).toContain(">Create a new kit</s-button>");
  });
  it("lets the kit size be typed as a number instead of picked from a list", () => {
    expect(html).toContain('label="Kit size"');
    expect(html).toContain('value="8"');
    expect(html).not.toContain("mini bars</s-option>");
  });
});
