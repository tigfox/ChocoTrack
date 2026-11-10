// Seeds a development store with mini bars, sampler kits and collections.
// Dev-store only: sample quantities are made up. Safe to re-run (skips existing SKUs).
// Usage: node scripts/seed-dev-store.mjs <store>.myshopify.com
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const store = process.argv[2];
if (!store?.endsWith(".myshopify.com")) {
  console.error("Usage: node scripts/seed-dev-store.mjs <store>.myshopify.com");
  process.exit(1);
}

// flavors.json stock order: [main, shop, popup]
const LOCATION_NAMES = ["Warehouse", "Market Store", "Cafe"];
const flavors = JSON.parse(readFileSync(new URL("../../mockup/src/data/flavors.json", import.meta.url), "utf8"));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const KITS = [
  { size: 4, price: "14.00", stock: [8, 3, null] },
  { size: 5, price: "17.00", stock: [6, 2, null] },
  { size: 6, price: "20.00", stock: [12, 0, null] },
  { size: 12, price: "38.00", stock: [5, null, null] },
];
const COLLECTIONS = [
  { key: "c-mini", title: "Mini bars (not sold individually)" },
  { key: "c-dark", title: "Dark chocolate" },
  { key: "c-milk", title: "Milk chocolate" },
];

const run = (query, variables, mutate = false) => {
  const args = ["store", "execute", "--store", store, "--json", "--query", query];
  if (variables) args.push("--variables", JSON.stringify(variables));
  if (mutate) args.push("--allow-mutations");
  const out = execFileSync("shopify", args, { encoding: "utf8", env: { ...process.env, OPT_OUT_INSTRUMENTATION: "true" } });
  const body = JSON.parse(out.slice(out.indexOf("{\n")));
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
};

const throwOnUserErrors = (label, errors) => {
  if (errors?.length) throw new Error(`${label}: ${JSON.stringify(errors)}`);
};

const locations = Object.fromEntries(
  run("{ locations(first: 20) { nodes { id name } } }").locations.nodes.map((l) => [l.name, l.id]),
);
for (const n of LOCATION_NAMES) if (!locations[n]) throw new Error(`Missing location: ${n}`);

const existingSkus = new Set(
  run("{ productVariants(first: 250) { nodes { sku } } }").productVariants.nodes.map((v) => v.sku).filter(Boolean),
);

const collectionIds = {};
const existingCollections = run("{ collections(first: 50) { nodes { id title } } }").collections.nodes;
for (const c of COLLECTIONS) {
  const found = existingCollections.find((e) => e.title === c.title);
  if (found) {
    collectionIds[c.key] = found.id;
    continue;
  }
  const d = run(
    "mutation($input: CollectionInput!) { collectionCreate(input: $input) { collection { id } userErrors { field message } } }",
    { input: { title: c.title } },
    true,
  ).collectionCreate;
  throwOnUserErrors(`collection ${c.title}`, d.userErrors);
  collectionIds[c.key] = d.collection.id;
}

const quantities = (stock) =>
  stock.flatMap((q, i) => (q === null ? [] : [{ locationId: locations[LOCATION_NAMES[i]], name: "available", quantity: q }]));

const createProduct = ({ title, sku, barcode, price, status, collections, stock }) => {
  if (existingSkus.has(sku)) return console.log(`skip  ${sku}`);
  const input = {
    title,
    status,
    collections,
    productOptions: [{ name: "Title", position: 1, values: [{ name: "Default Title" }] }],
    variants: [
      {
        optionValues: [{ optionName: "Title", name: "Default Title" }],
        sku,
        barcode,
        price,
        inventoryItem: { tracked: true },
        inventoryQuantities: quantities(stock),
      },
    ],
  };
  const d = run(
    "mutation($input: ProductSetInput!) { productSet(synchronous: true, input: $input) { product { id } userErrors { field message } } }",
    { input },
    true,
  ).productSet;
  throwOnUserErrors(sku, d.userErrors);
  console.log(`added ${sku}`);
};

flavors.forEach((f, i) =>
  createProduct({
    title: `Mini - ${f.name}`,
    sku: `MINI-${slug(f.name).toUpperCase()}`,
    barcode: `8500100${String(i + 1).padStart(5, "0")}`,
    price: "0.00",
    status: "DRAFT", // not sold individually
    collections: ["c-mini", ...f.collections].map((k) => collectionIds[k]),
    stock: f.stock,
  }),
);
for (const k of KITS) {
  createProduct({
    title: `Sampler Kit - ${k.size} Pack`,
    sku: `SMP-${k.size}`,
    barcode: `85003000000${String(k.size).padStart(2, "0")}`,
    price: k.price,
    status: "ACTIVE",
    collections: [],
    stock: k.stock,
  });
}
