# ChocoTrack

A Shopify embedded admin app with two parts. Shopify holds all records; the app stores only OAuth sessions.

- **Inventory** (the main purpose): watch selected products against a minimum and maximum per location, flag what is low, and suggest transfers between locations as draft transfers in Shopify. Plan and status: [`inventory_tracker.md`](inventory_tracker.md).
- **Sampler Builder**: assembles and disassembles physical sampler kits (4, 5, 6 and 12 packs) from mini chocolate bar inventory, using one atomic `inventoryAdjustQuantities` call per run. Plan and status: [`sampler_builder.md`](sampler_builder.md).

| Folder | What |
|---|---|
| `choco-track/` | The Shopify app (React Router, TypeScript, Polaris web components, Prisma for sessions) |
| `mockup/` | The clickable mockup used for store-team feedback (Vite + Docker, fake data). **Frozen** - kept for reference only |

## Run the app (development)

Prerequisites: Node 22.12+, [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) 5+, a Partner/Dev Dashboard account and a development store.

```bash
cd choco-track
npm install
shopify app dev        # interactive: choose the dev store, opens the embedded app
```

Screens: **Inventory** (`/app/inventory`, the home page), **Assemble** (`/app/assemble`), **Disassemble** (`/app/disassemble`) and **Settings** (`/app/settings`: kits, categories and transfer source locations). Products are flagged for the Inventory report with the `choco_track.tracked` product metafield and given targets in the `choco_track.targets` variant metafield (both are set from the app). A kit is a product tagged `choco-track-kit` with an integer metafield `choco_track.kit_size` (the app's "Create a new kit" does this for you).

## Seed a development store

Sample mini bars, kits and collections (made-up stock; dev stores only):

```bash
shopify store auth --store <store>.myshopify.com --scopes read_products,write_products,read_inventory,write_inventory,read_locations,read_inventory_transfers,write_inventory_transfers
node scripts/seed-dev-store.mjs <store>.myshopify.com
```

It expects locations named Warehouse, Market Store and Cafe, and skips SKUs that already exist.

Optionally add the name-only product pictures (so the box preview and printed pick list show images):

```bash
node scripts/upload-dev-images.mjs <store>.myshopify.com   # skips products that already have media
```

## Checks

```bash
npm run typecheck && npm run lint && npm run build
npm run test:coverage                                # unit tests, 80% gate (currently 100% lines)
LIVE_STORE=<store>.myshopify.com npm run test:live  # real queries + an assemble/disassemble round trip (net zero)
```

The unit tests use a fake GraphQL client. The live test needs the `shopify store auth` step above.

## Mockup (frozen)

Approved by the store team and no longer maintained or run in CI. To look at it:

```bash
cd mockup && docker compose up --build   # http://localhost:8080
```

## Deploy

Initial hosting is a small DigitalOcean Droplet (Docker Compose, Caddy HTTPS, SQLite sessions). Setup, secrets, deploys, rollback and backups are in [`deploy/droplet/README.md`](deploy/droplet/README.md). CI/CD is `.github/workflows/ci.yml`. If the app outgrows the Droplet, see "Moving on" in that file.
