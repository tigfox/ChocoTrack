# ChocoTrack

A Shopify embedded admin app with two parts. Shopify holds all records; the app stores only OAuth sessions.

- **Inventory** (the main purpose): watch selected products against a minimum and maximum per location, flag what is low, and suggest transfers between locations as draft transfers in Shopify. Plan and status: [`inventory_tracker.md`](inventory_tracker.md). Planned next: a setup guide that must be finished before alerts show ([`inventory_onboarding_plan.md`](inventory_onboarding_plan.md)) and history graphs (see "Future development" in the tracker doc).
- **Sampler Builder**: assembles and disassembles physical sampler kits (any size from 1 to 48 bars) from mini chocolate bar inventory, using one atomic `inventoryAdjustQuantities` call per run. Plan and status: [`sampler_builder.md`](sampler_builder.md).

| Folder | What |
|---|---|
| `choco-track/` | The Shopify app (React Router, TypeScript, Polaris web components, Prisma for sessions) |
| `deploy/droplet/` | The production stack (Docker Compose, Caddy, scripts) and its runbook |
| `dropaudit.sh` | Read-only security audit of the Droplet |
| `mockup/` | The clickable mockup used for store-team feedback (Vite + Docker, fake data). **Frozen** - kept for reference only |

## Run the app (development)

Prerequisites: Node 22.12+, [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) 5+, a Partner/Dev Dashboard account and a development store.

```bash
./start.sh             # from the repo root: starts the DEV app safely (see below)

# or by hand:
cd choco-track
npm install
shopify app dev --config shopify.app.toml   # always name the dev config: the CLI can otherwise attach to the production app (see choco-track/e2e/README.md)
```

`start.sh` always names the dev config (`shopify.app.toml`), refuses to run if that config is not the dev app, and removes the dev preview when you press Ctrl+C. `./start.sh check` only verifies the setup; `./start.sh clean` removes a leftover preview. While it runs, open **ChocoTrack** (not *ChocoTrack Production*) in the dev store's admin; when it is stopped the dev app shows `https://example.com`, which is normal. Production only gets tested, reviewed code.

Screens: **Inventory** (`/app/inventory`, the home page), **Assemble** (`/app/assemble`), **Disassemble** (`/app/disassemble`) and **Settings** (`/app/settings`: kits, categories and transfer source locations). Products are flagged for the Inventory report with the `choco_track.tracked` product metafield and given targets in the `choco_track.targets` variant metafield (both are set from the app). A kit is a variant whose product is tagged `choco-track-kit` and which has an integer metafield `choco_track.kit_size` (and optionally `choco_track.category`, a collection). Settings can mark an existing product as a kit (its inventory must be tracked) or create a new one. Mini bar flavors are variants of their category product (`Mini Bars - Rare`); a variant's `choco_track.display_name` metafield is the name shown in the app.

## Rebuild a development store from the River Sea export

`scripts/import-river-sea.mjs` replaces every product in a **development store** with a Shopify product export, applies the SKUs from `Mini SKUs.csv`, sets starting stock from an inventory export (minis 1500 at the Factory; 60g bars and other tracked variants without real counts get made-up stock), and creates the `Mini bars` and per-category collections. It refuses to run against a store that is not a partner development store, validates everything before writing, and only deletes with `--apply`.

```bash
shopify store auth --store <store>.myshopify.com --scopes read_products,write_products,read_inventory,write_inventory,read_locations,read_publications,write_publications
npx esbuild scripts/import-river-sea.mjs --bundle --platform=node --format=esm --outfile=/tmp/import-river-sea.mjs
node /tmp/import-river-sea.mjs <store>.myshopify.com products_export_1.csv "Mini SKUs.csv" inventory_export_1.csv            # dry run
node /tmp/import-river-sea.mjs <store>.myshopify.com products_export_1.csv "Mini SKUs.csv" inventory_export_1.csv --probe    # create and remove one throwaway product
node /tmp/import-river-sea.mjs <store>.myshopify.com products_export_1.csv "Mini SKUs.csv" inventory_export_1.csv --apply --confirm=<store>.myshopify.com --kits   # asks you to repeat the domain before deleting every product
node /tmp/import-river-sea.mjs <store>.myshopify.com products_export_1.csv "Mini SKUs.csv" inventory_export_1.csv --finish --kits  # only collections, flavor names, published flags, kits
```

It expects locations named Warehouse, Factory, Market Store and Cafe (the live store's Myterra Warehouse, Reston, Union Market and Chantilly). Save a snapshot of the store before `--apply`. The export's `Published` column is applied to the Online Store channel (needs the `read_publications`/`write_publications` scopes above; without them that step is skipped with a warning).

## Checks

```bash
npm run typecheck && npm run lint && npm run build
npm run test:coverage                                # unit and render tests, 80% gate (868 tests, 99% lines)
LIVE_STORE=<store>.myshopify.com npm run test:live  # real queries + an assemble/disassemble round trip (net zero)
```

The unit tests use a fake GraphQL client. The live test needs the `shopify store auth` step above.

## Mockup (frozen)

Approved by the store team and no longer maintained or run in CI. To look at it:

```bash
cd mockup && docker compose up --build   # http://localhost:8080
```

## Deploy

Production runs at `https://chocotrack.franson.nyc` on a small DigitalOcean Droplet (Docker Compose, Caddy with a Let's Encrypt certificate, SQLite sessions). Setup, secrets, deploys, rollback and backups are in [`deploy/droplet/README.md`](deploy/droplet/README.md). CI/CD is `.github/workflows/ci.yml`: a push to `main` runs the checks, builds the image, and (after a reviewer approves the `production` environment) deploys it by digest through a restricted SSH key. If the app outgrows the Droplet, see "Moving on" in that file.

Security posture, in short: key-only SSH with no root login, read-only containers with no capabilities, images pinned by digest, a CI key that can only deploy an image, private and backed-up session data, unsigned webhooks rejected at the edge, and a blank public home page (`/` shows nothing; Shopify's `?shop=` visits are forwarded into the app). The latest findings and what is deliberately deferred are in "Security review" in [`sampler_builder.md`](sampler_builder.md).
