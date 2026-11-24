// Replaces every product in a DEVELOPMENT store with the River Sea product export, then sets starting stock.
// Refuses to run against a store that is not a partner development store. Without --apply it only validates and prints a summary.
// --finish skips the delete and import: it only syncs the collections, flavor names and published flags (and, with --kits, marks the kit variants) on the store as it is.
// Usage: npx esbuild scripts/import-river-sea.mjs --bundle --platform=node --format=esm --outfile=/tmp/import-river-sea.mjs && node /tmp/import-river-sea.mjs <store>.myshopify.com <products_export.csv> <Mini SKUs.csv> <inventory_export.csv> [--apply | --finish] [--kits]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { csvToRecords, parseCsv } from "../app/lib/csvParse";
import { groupProducts } from "../app/lib/riverSeaExport";
import { buildProductSetInput } from "../app/lib/riverSeaProductSet";
import { collectionSpecs, MINI_CATEGORIES, STALE_COLLECTION_TITLES } from "../app/lib/riverSeaCollections";
import { KIT_SIZE_METAFIELD, KIT_TAG, kitSizeFor } from "../app/lib/riverSeaKits";
import { miniDisplayName, nonMiniTitles } from "../app/lib/riverSeaNames";
import { DISPLAY_NAME_METAFIELD } from "../app/shopify/catalog";
import { parseInventory, actualStockKey } from "../app/lib/riverSeaInventory";
import { applySkus, parseSkuCsv } from "../app/lib/riverSeaSkus";
import { planStock, STOCK_LOCATIONS } from "../app/lib/riverSeaStock";

const [store, exportPath, skuPath, inventoryPath, ...flags] = process.argv.slice(2);
const apply = flags.includes("--apply");
if (!store?.endsWith(".myshopify.com") || !exportPath || !skuPath || !inventoryPath) {
  console.error("Usage: node scripts/import-river-sea.mjs <store>.myshopify.com <products_export.csv> <Mini SKUs.csv> <inventory_export.csv> [--apply | --finish] [--kits]");
  process.exit(1);
}

// Mini SKUs.csv names the six categories that have SKUs; White Chocolate has none yet.
const SKU_CATEGORY_HANDLES = Object.fromEntries(MINI_CATEGORIES.filter((c) => c.title !== "White Chocolate").map((c) => [c.title, c.handle]));

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

// Collections: remove the old seed ones, then create the smart collections (skipping any that already exist).
async function syncCollections() {
  const collections = run("{ collections(first: 100) { nodes { id title } } }").collections.nodes;
  for (const c of collections.filter((x) => STALE_COLLECTION_TITLES.includes(x.title))) {
    userErrors(`delete collection ${c.title}`, run("mutation($input: CollectionDeleteInput!) { collectionDelete(input: $input) { userErrors { field message } } }", { input: { id: c.id } }, true).collectionDelete.userErrors);
    console.log(`removed old collection ${c.title}`);
  }
  for (const spec of specs.filter((x) => !collections.some((c) => c.title === x.title))) {
    const input = { title: spec.title, ruleSet: { appliedDisjunctively: false, rules: spec.rules } };
    userErrors(`collection ${spec.title}`, run("mutation($input: CollectionInput!) { collectionCreate(input: $input) { userErrors { field message } } }", { input }, true).collectionCreate.userErrors);
    console.log(`created collection ${spec.title}`);
  }
}

// Display names on an already-imported store: write choco_track.display_name on each mini flavor variant.
async function writeDisplayNamesInStore() {
  for (const p of products) {
    const names = new Map(p.variants.flatMap((v) => (displayNameFor(p, v) === undefined ? [] : [[v.optionValues.join("\u0000"), displayNameFor(p, v)]])));
    if (names.size === 0) continue;
    const found = run("query($h: String!) { productByHandle(handle: $h) { variants(first: 50) { nodes { id selectedOptions { value } } } } }", { h: p.handle }).productByHandle;
    if (!found) throw new Error(`Store has no product ${p.handle}; run --apply first`);
    const metafields = found.variants.nodes.flatMap((v) => {
      const name = names.get(v.selectedOptions.map((o) => o.value).join("\u0000"));
      return name === undefined ? [] : [{ ownerId: v.id, namespace: DISPLAY_NAME_METAFIELD.namespace, key: DISPLAY_NAME_METAFIELD.key, type: "single_line_text_field", value: name }];
    });
    userErrors(`names ${p.handle}`, run("mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { field message } } }", { m: metafields }, true).metafieldsSet.userErrors);
    console.log(`named ${metafields.length} flavor(s) on ${p.handle}`);
  }
}

// Online Store published flags from the export. Needs read_publications/write_publications; without them it says so and carries on.
async function syncPublished() {
  let publicationId;
  try {
    publicationId = run("{ publications(first: 20) { nodes { id name } } }").publications.nodes.find((p) => /^online\s*store$/i.test(p.name))?.id;
  } catch (e) {
    console.warn(`Skipping published flags (re-run shopify store auth with read_publications,write_publications): ${String(e.message).slice(0, 160)}`);
    return;
  }
  if (!publicationId) return console.warn("Skipping published flags: the store has no Online Store channel.");
  const wanted = new Map(products.map((p) => [p.handle, p.published]));
  let changed = 0;
  for (let after = null; ; ) {
    const d = run("query($after: String, $pub: ID!) { products(first: 50, after: $after) { pageInfo { hasNextPage endCursor } nodes { id handle publishedOnPublication(publicationId: $pub) } } }", { after, pub: publicationId }).products;
    for (const p of d.nodes) {
      const should = wanted.get(p.handle);
      if (should === undefined || should === p.publishedOnPublication) continue;
      const mutation = should
        ? "mutation($id: ID!, $i: [PublicationInput!]!) { publishablePublish(id: $id, input: $i) { userErrors { message } } }"
        : "mutation($id: ID!, $i: [PublicationInput!]!) { publishableUnpublish(id: $id, input: $i) { userErrors { message } } }";
      const r = run(mutation, { id: p.id, i: [{ publicationId }] }, true);
      userErrors(`publish ${p.handle}`, (r.publishablePublish ?? r.publishableUnpublish).userErrors);
      changed++;
    }
    if (!d.pageInfo.hasNextPage) break;
    after = d.pageInfo.endCursor;
  }
  console.log(`Published flags synced (${changed} changed).`);
}

// Kits on an already-imported store: tag each kit product and set the size on the variant.
async function markKitsInStore() {
  for (const p of products) {
    const sizes = new Map(p.variants.flatMap((v) => (kitSizeFor(p, v) === undefined ? [] : [[v.optionValues.join("\u0000"), kitSizeFor(p, v)]])));
    if (sizes.size === 0) continue;
    const found = run("query($h: String!) { productByHandle(handle: $h) { id tags variants(first: 50) { nodes { id selectedOptions { value } } } } }", { h: p.handle }).productByHandle;
    if (!found) throw new Error(`Store has no product ${p.handle}; run --apply first`);
    if (!found.tags.includes(KIT_TAG)) userErrors(`tag ${p.handle}`, run("mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }", { id: found.id, tags: [KIT_TAG] }, true).tagsAdd.userErrors);
    const metafields = found.variants.nodes.flatMap((v) => {
      const size = sizes.get(v.selectedOptions.map((o) => o.value).join("\u0000"));
      return size === undefined ? [] : [{ ownerId: v.id, namespace: KIT_SIZE_METAFIELD.namespace, key: KIT_SIZE_METAFIELD.key, type: "number_integer", value: String(size) }];
    });
    if (metafields.length === 0) continue;
    userErrors(`kit sizes ${p.handle}`, run("mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { field message } } }", { m: metafields }, true).metafieldsSet.userErrors);
    console.log(`marked ${metafields.length} kit variant(s) on ${p.handle}`);
  }
}

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
const titles = nonMiniTitles(products);
const displayNameFor = (p, v) => miniDisplayName(p, v, titles);
const markKits = flags.includes("--kits");
const inputs = products.map((p) => ({ handle: p.handle, input: buildProductSetInput(p, { categoryIds, stockFor, displayNameFor, ...(markKits ? { kitSizeFor } : {}) }) }));
const specs = collectionSpecs(products);

const variants = products.flatMap((p) => p.variants);
if (markKits) {
  const kits = products.flatMap((p) => p.variants.flatMap((v) => (kitSizeFor(p, v) === undefined ? [] : [`${p.handle} / ${v.optionValues.join(" ")} = ${kitSizeFor(p, v)}`])));
  console.log(`Kits to mark (${kits.length}):\n  ${kits.join("\n  ")}`);
}
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
if (flags.includes("--finish")) {
  await syncCollections();
  await writeDisplayNamesInStore();
  if (markKits) await markKitsInStore();
  await syncPublished();
  console.log("Finished collections, flavor names and published flags" + (markKits ? " and kits." : "."));
  process.exit(0);
}
if (!apply) {
  console.log("Dry run only. Re-run with --apply to delete the store's products and import these (or --finish to only sync collections and kits).");
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

await syncCollections();
await syncPublished();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(2);
}
