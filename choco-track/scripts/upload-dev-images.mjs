// Attaches the name-only PNGs in scripts/seed-images/mini to the dev store's mini bar products.
// Dev-store only. Safe to re-run: products that already have media are skipped.
// Usage: node scripts/upload-dev-images.mjs <store>.myshopify.com [--only <slug>]
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";

const store = process.argv[2];
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : undefined;
if (!store?.endsWith(".myshopify.com")) {
  console.error("Usage: node scripts/upload-dev-images.mjs <store>.myshopify.com [--only <slug>]");
  process.exit(1);
}

const dir = new URL("./seed-images/mini/", import.meta.url);

const run = (query, variables) => {
  const args = ["store", "execute", "--store", store, "--json", "--allow-mutations", "--query", query];
  if (variables) args.push("--variables", JSON.stringify(variables));
  const out = execFileSync("shopify", args, { encoding: "utf8", env: { ...process.env, OPT_OUT_INSTRUMENTATION: "true" } });
  const body = JSON.parse(out.slice(out.indexOf("{\n")));
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
};

const check = (label, errors) => {
  if (errors?.length) throw new Error(`${label}: ${JSON.stringify(errors)}`);
};

const titleFrom = (sku) => sku;

const files = readdirSync(dir).filter((f) => f.endsWith(".png") && (!only || f === `${only}.png`));
for (const file of files) {
  const slug = file.replace(".png", "");
  const sku = `MINI-${slug.toUpperCase()}`;
  const found = run(
    "query($q:String!){ productVariants(first:1, query:$q){ nodes{ sku product{ id title mediaCount{ count } } } } }",
    { q: `sku:${sku}` },
  ).productVariants.nodes[0];
  if (found?.sku !== sku) {
    console.log(`skip  ${sku} (no such product)`);
    continue;
  }
  if (found.product.mediaCount.count > 0) {
    console.log(`skip  ${sku} (already has media)`);
    continue;
  }

  const path = new URL(file, dir);
  const staged = run(
    "mutation($input:[StagedUploadInput!]!){ stagedUploadsCreate(input:$input){ stagedTargets{ url resourceUrl parameters{ name value } } userErrors{ field message } } }",
    { input: [{ filename: file, mimeType: "image/png", httpMethod: "POST", resource: "IMAGE", fileSize: String(statSync(path).size) }] },
  ).stagedUploadsCreate;
  check(`stage ${sku}`, staged.userErrors);
  const target = staged.stagedTargets[0];

  const form = new FormData();
  for (const { name, value } of target.parameters) form.append(name, value);
  form.append("file", new Blob([readFileSync(path)], { type: "image/png" }), file);
  const upload = await fetch(target.url, { method: "POST", body: form });
  if (!upload.ok) throw new Error(`upload ${sku}: HTTP ${upload.status}`);

  const updated = run(
    "mutation($product:ProductUpdateInput!, $media:[CreateMediaInput!]){ productUpdate(product:$product, media:$media){ product{ id } userErrors{ field message } } }",
    {
      product: { id: found.product.id },
      media: [{ originalSource: target.resourceUrl, mediaContentType: "IMAGE", alt: titleFrom(found.product.title) }],
    },
  ).productUpdate;
  check(`attach ${sku}`, updated.userErrors);
  console.log(`added ${sku}`);
}
