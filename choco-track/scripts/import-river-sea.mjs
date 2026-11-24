// Replaces every product in a DEVELOPMENT store with the River Sea product export, then sets starting stock.
// Refuses to run against a store that is not a partner development store. Without --apply it only validates and prints a summary.
// Usage: npx esbuild scripts/import-river-sea.mjs --bundle --platform=node --format=esm --outfile=/tmp/import-river-sea.mjs && node /tmp/import-river-sea.mjs <store>.myshopify.com <products_export.csv> <Mini SKUs.csv> <inventory_export.csv> [--apply]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { csvToRecords, parseCsv } from "../app/lib/csvParse";
import { groupProducts } from "../app/lib/riverSeaExport";
import { buildProductSetInput } from "../app/lib/riverSeaProductSet";
import { parseInventory, actualStockKey } from "../app/lib/riverSeaInventory";
import { applySkus, parseSkuCsv } from "../app/lib/riverSeaSkus";
import { planStock, STOCK_LOCATIONS } from "../app/lib/riverSeaStock";

const [store, exportPath, skuPath, inventoryPath, ...flags] = process.argv.slice(2);
const apply = flags.includes("--apply");
if (!store?.endsWith(".myshopify.com") || !exportPath || !skuPath || !inventoryPath) {
  console.error("Usage: node scripts/import-river-sea.mjs <store>.myshopify.com <products_export.csv> <Mini SKUs.csv> <inventory_export.csv> [--apply]");
  process.exit(1);
}

const SKU_CATEGORY_HANDLES = {
  "Limited Editions": "mini-bars-limited-editions",
  "Dark Milks": "mini-bars-dark-milks",
  Rare: "mini-bars-rare",
  "Single Origin": "mini-bars-single-origins",
  Dark: "mini-bars-darks",
  Milk: "mini-bars-milks",
};

const run = (query, variables, mutate = false) => {
  const args = ["store", "execute", "--store", store, "--json", "--query", query];
  if (variables) args.push("--variables", JSON.stringify(variables));
  if (mutate) args.push("--allow-mutations");
  let out;
  try {
    out = execFileSync("shopify", args, { encoding: "utf8", maxBuffer: 1 << 27, env: { ...process.env, OPT_OUT_INSTRUMENTATION: "true" } });
  } catch (e) {
    const detail = String(e.stdout ?? "").split("\n").filter((l) => l.includes('"message"')).join(" ");
    throw new Error(`Shopify CLI call failed: ${(detail || e.message).slice(0, 600)}`);
  }
  const body = JSON.parse(out.slice(out.indexOf("{\n")));
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
};
const userErrors = (label, errors) => {
  if (errors?.length) throw new Error(`${label}: ${JSON.stringify(errors)}`);
};
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// 1. Safety: only ever touch a development store.
const shop = run("{ shop { name myshopifyDomain plan { partnerDevelopment } } }").shop;
if (shop.myshopifyDomain !== store || !shop.plan.partnerDevelopment) {
  console.error(`Refusing to run: ${shop.myshopifyDomain} is not a partner development store.`);
  process.exit(1);
}
console.log(`Target: ${shop.name} (${shop.myshopifyDomain}), development store`);

// 2. Parse and validate everything before any write.
const parsed = groupProducts(csvToRecords(parseCsv(readFileSync(exportPath, "utf8"))));
const products = applySkus(parsed, parseSkuCsv(readFileSync(skuPath, "utf8")), SKU_CATEGORY_HANDLES);
const handles = products.map((p) => p.handle);
if (new Set(handles).size !== handles.length) throw new Error("Duplicate handles in export");

const locations = Object.fromEntries(run("{ locations(first: 20) { nodes { id name } } }").locations.nodes.map((l) => [l.name, l.id]));
for (const n of STOCK_LOCATIONS) if (!locations[n]) throw new Error(`Missing location: ${n}`);

const categoryIds = {};
for (const name of new Set(products.map((p) => p.category).filter(Boolean))) {
  const leaf = name.split(">").at(-1).trim();
  const nodes = run("query($q: String!) { taxonomy { categories(search: $q, first: 25) { nodes { id fullName } } } }", { q: leaf }).taxonomy.categories.nodes;
  const hit = nodes.find((c) => c.fullName === name);
  if (!hit) throw new Error(`No taxonomy category matches "${name}"`);
  categoryIds[name] = hit.id;
}

const random = seeded(2026);
const actual = parseInventory(csvToRecords(parseCsv(readFileSync(inventoryPath, "utf8"))));
const stockFor = (p, v) => planStock(p, v, locations, random, actual.get(actualStockKey(p.handle, v.optionValues)));
const inputs = products.map((p) => ({ handle: p.handle, input: buildProductSetInput(p, { categoryIds, stockFor }) }));

const variants = products.flatMap((p) => p.variants);
console.log(`Parsed ${products.length} products, ${variants.length} variants, ${variants.filter((v) => v.sku).length} with SKUs, ${variants.filter((v) => v.tracked).length} tracked.`);
if (flags.includes("--probe")) {
  // Creates one product (the first mini bars category) under a throwaway handle, reads it back, then deletes it.
  const sample = inputs.find((x) => x.handle === "mini-bars-dark-milks");
  const probe = { ...sample.input, handle: "zz-import-probe", title: "ZZ import probe" };
  const created = run("mutation($input: ProductSetInput!) { productSet(synchronous: true, input: $input) { product { id variants(first: 10) { nodes { sku barcode inventoryItem { tracked inventoryLevels(first: 6) { nodes { location { name } quantities(names: [\"available\"]) { quantity } } } } } } } userErrors { field message } } }", { input: probe }, true).productSet;
  try {
    userErrors("probe", created.userErrors);
    console.log(JSON.stringify(created.product.variants.nodes, null, 1));
  } finally {
    if (created.product?.id) run("mutation($input: ProductDeleteInput!) { productDelete(input: $input, synchronous: true) { userErrors { message } } }", { input: { id: created.product.id } }, true);
  }
  console.log("Probe OK and removed.");
  process.exit(0);
}
if (!apply) {
  console.log("Dry run only. Re-run with --apply to delete the store's products and import these.");
  process.exit(0);
}

// 3. Delete every existing product.
const existing = [];
for (let after = null; ; ) {
  const d = run("query($after: String) { products(first: 50, after: $after) { pageInfo { hasNextPage endCursor } nodes { id handle } } }", { after }).products;
  existing.push(...d.nodes);
  if (!d.pageInfo.hasNextPage) break;
  after = d.pageInfo.endCursor;
}
console.log(`Deleting ${existing.length} existing products...`);
for (const p of existing) {
  const d = run("mutation($input: ProductDeleteInput!) { productDelete(input: $input, synchronous: true) { deletedProductId userErrors { field message } } }", { input: { id: p.id } }, true).productDelete;
  userErrors(`delete ${p.handle}`, d.userErrors);
}

// 4. Import.
const failures = [];
for (const [i, { handle, input }] of inputs.entries()) {
  try {
    const d = run("mutation($input: ProductSetInput!) { productSet(synchronous: true, input: $input) { product { id } userErrors { field message } } }", { input }, true).productSet;
    userErrors(handle, d.userErrors);
    console.log(`[${i + 1}/${inputs.length}] ${handle}`);
  } catch (e) {
    failures.push({ handle, error: String(e.message).slice(0, 400) });
    console.error(`[${i + 1}/${inputs.length}] FAILED ${handle}`);
  }
}
console.log(`Imported ${inputs.length - failures.length}/${inputs.length}.`);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(2);
}
