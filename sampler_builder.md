# Sampler Builder - Development Plan

A Shopify app that assembles "sampler kits" from mini chocolate bar inventory, using the Admin GraphQL [`InventoryItem`](https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryItem) and inventory adjustment APIs.

## Decisions

| Area | Decision |
|---|---|
| Kit model | Assembled/physical kits. Assembly consumes components and adds stock to the kit's InventoryItem. |
| Kit sizes | Four variants: **4-pack** (1x4 box), **5-pack** (1x5), **6-pack** (1x6) and **12-pack** (2x6). Mini bars per kit must equal the kit size exactly. |
| Components | About 20 flavors of mini chocolate bar (the mockup uses 23 names taken from the River Sea Chocolates bar collection). Tracked in inventory, not sold individually. Any combination may go in a kit. |
| Recipe | None stored. Components and quantities are chosen at each assembly run (the same mix is built N times per run). |
| Kit SKU | An ordinary tracked variant. The app can create it or link an existing variant. |
| Disassembly | The mini bars in one kit are entered manually (they must equal the kit size); returned stock is that mix x the number of kits. |
| Locations | Multi-location. Every run happens at a chosen location. |
| Component picker | Search by title, SKU or barcode (scanner-style Enter to add), with a collection filter (defaults to the mini-bar collection). |
| Records | Shopify only: no app-side business tables. Adjustment `reason` and `referenceDocumentUri` form the audit trail in Shopify's inventory history. |
| Pick list | A printable pick list is available before any change is saved: what to pull from stock, how many of each, from which location. Printing is optional and never changes inventory. |
| Box image | The assemble screen shows an image of the finished box, composed from the Shopify product images of the chosen mini bars. |
| Surface | Embedded admin UI only. No storefront, POS or order webhooks in v1. |
| Stack | Shopify CLI React Router template (TypeScript, Polaris, App Bridge). Prisma only for OAuth session storage. |
| Distribution | Built for one store; no hardcoded shop so it can go public later. |
| Hosting | **Undecided - the store team chooses among AWS, GCP, DigitalOcean App Platform, or a DigitalOcean Droplet.** Build container-portable so any works (see Hosting). |
| Deferred | Lots and expiry dates, cost rollup, templates, audit/history UI. |

## Key design points

1. **Atomic adjustments.** One `inventoryAdjustQuantities` call carries all changes: a negative line per component and one positive line for the kit. Either every line applies or none does, so there is no partial-failure cleanup. Use `name: "available"`, a `reason`, and a `referenceDocumentUri` such as `gid://choco-track/Assembly/<uuid>`. Disassembly is the mirror image.
2. **Idempotency.** Newer API versions require an idempotency key on this mutation. Confirm against current docs; generate one key per submit so a double-click or retry cannot assemble twice.
3. **Validation before the mutation.** Every item is tracked and stocked at the chosen location (activate the kit item with `inventoryActivate` if needed). Quantities are whole numbers, units per kit equal the kit size, stock is sufficient, and no component is also the kit. Max buildable is `min(floor(available / qtyPerKit))`.
4. **Kit creation.** The app creates a product/variant with tracked inventory via `productSet` or `productCreate`, or links an existing variant.
5. **Search.** `productVariants(query:)` with `sku:` and `barcode:` filters plus collection filtering. Inventory levels come from `inventoryItem.inventoryLevels`.
6. **Scopes.** `read_products`, `write_products`, `read_inventory`, `write_inventory`, `read_locations`.

## Hosting (AWS, GCP or DigitalOcean - pending store-team decision)

The app is a stateless Node web server plus a small database for Shopify OAuth sessions only (kit data lives in Shopify). That keeps every option below simple.

**Portability rules from day one**
- Ship as a container image (the Shopify template includes a Dockerfile), configured only through environment variables.
- Prisma on PostgreSQL for session storage; no provider-specific SDKs in the domain or service layers.
- Secrets (Shopify API key and secret, DB URL) come from the platform secret manager, never from the repo.
- Public HTTPS URL with a stable domain, because Shopify needs an app URL, OAuth redirect URLs and webhook endpoints (`app/uninstalled`, and the GDPR topics if the app goes public).
- A health-check endpoint, structured logs to stdout, and CI that builds, tests and pushes the image.

| Concern | AWS | GCP | DigitalOcean App Platform | DigitalOcean Droplet |
|---|---|---|---|---|
| Runtime | ECS Fargate (or App Runner) behind an ALB | Cloud Run | Managed container service (deploy from image or GitHub) | One VM running Docker Compose, with Caddy or nginx for HTTPS |
| Database | RDS PostgreSQL (small) | Cloud SQL PostgreSQL (small) | Dev database or managed Postgres | Postgres container on the VM, or managed Postgres |
| Secrets | Secrets Manager | Secret Manager | App-level encrypted env vars | Env file on the VM (restricted permissions) |
| Registry | ECR | Artifact Registry | DigitalOcean Container Registry | DigitalOcean Container Registry or Docker Hub |
| Logs | CloudWatch | Cloud Logging | Built-in logs | Docker logs; ship elsewhere if needed |
| Scale to zero | No (Fargate) / paused (App Runner) | Yes | No, always on | No, always on |
| IaC | Terraform | Terraform | Terraform or app spec file | Terraform plus a Compose file |
| Approx. monthly cost* | $15-30 | $10-25 | $12-20 | ~$6 |
| Ops burden | Low-medium | Low | Low | Higher: patching, backups and deploys are ours |

*Rough figures from memory for a very low-usage app; verify with each provider's pricing page.

Cloud Run, App Runner and App Platform are the lowest-effort options for a low-traffic internal app. A Droplet is the cheapest but we would own OS patching, backups, TLS renewal and deploy scripts. Questions for the store team: any existing cloud account or compliance constraints, who owns billing and deploys, and whether a staging environment is needed.

## Phases (TDD, 80%+ coverage)

### Phase 0 - Clickable mockup for store-team feedback  *(built and signed off by the store team; 5-pack added from their feedback)*

A standalone React + Vite + TypeScript app in `/mockup`, using real Polaris web components (`s-*` elements from Shopify's CDN, typed with `@shopify/polaris-types`) in React 19, fake data and no backend, served by nginx in Docker on this laptop (`docker compose up --build`, http://localhost:8080).

- Screens: Assemble, Disassemble, Create kit, a printable pick list, a box preview built from name-only placeholder images, and the result states (success, shortage, not stocked, stale-stock conflict).
- Pure domain logic (`src/domain`) is unit-tested and is meant to carry over into the real app. UI flows are covered by Playwright end-to-end tests in a real browser, since jsdom does not run the web components.
- `mockup/WALKTHROUGH.md` holds the feedback scenarios and questions.
- **Gate passed:** the store team signed off. Phase 1 is next.

Notes: the mockup page needs internet access to load Polaris from Shopify's CDN. It works standalone without App Bridge. `s-select` does not refresh option labels when they change, so the mockup remounts it when stock text changes; expect the same in the real app.

### Phase 1 - Shopify app scaffold

- Create a Partner account and a development store with sample products across several locations.
- Scaffold with `shopify app init`; commit.
- Check current docs for dev-store creation, API version and `@idempotent` requirements.

### Phase 2 - Domain core

Move `mockup/src/domain` into the app (or a shared package) and adjust for any feedback. Pure functions, no network.

*Done:* copied to `choco-track/app/domain` (types, stock, validate, apply, search, counts, box, pickList) with their tests, Vitest and a coverage threshold of 80%. The mockup's `workflow.ts` (stale-stock simulation) stays mockup-only. The mockup keeps its own copy of the domain until it is retired, so fixes must be made in both for now.

### Phase 3 - Shopify service layer

A repository-style wrapper around the GraphQL calls (locations, variant search, levels, adjust, activate, create kit) with `userErrors` mapped to friendly messages. Integration-tested against mocked responses.

*Done:* `choco-track/app/shopify` holds `client` (wraps the template's `admin.graphql`), `locations`, `catalog` (search with collection filter, kits, collections, images), `inventory` (stock levels, `inventoryActivate`, the single atomic `inventoryAdjustQuantities` call), `kits` (create a kit) and `submit` (validate, activate, adjust, refresh on conflict). Verified against the dev store with `npm run test:live`.

Findings from the live store that shape the app:
- `inventoryAdjustQuantities` takes the idempotency key as a variable (`@idempotent(key: $key)`) and each line needs `changeFromQuantity`. A stale quantity returns `CHANGE_FROM_QUANTITY_STALE`, which becomes the "stock changed" conflict message.
- A kit is a product tagged `choco-track-kit` with an integer metafield `choco_track.kit_size`. Shopify cannot search variants by tag or metafield, so kits are listed through `products(query: "tag:choco-track-kit")`.
- Free-text variant search matches title, SKU prefix and exact barcode; `collection:<id>` narrows by collection.
- The adjustment reason is `correction`; `referenceDocumentUri` (`gid://choco-track/Assembly/<uuid>` or `Disassembly`) says what happened.

### Phase 4 - Assemble UI

Wire the approved mockup screens to the service layer: location, kit pick/create, mix picker, live max buildable, submit with success or error banner.

### Phase 4b - Printable pick list (before saving)

A **Print pick list** action next to Assemble (and Break down) that opens a print-ready sheet without changing inventory, so the team can pull stock first and submit afterwards.

- Contents: date, location, kit (title, SKU), number of kits, and a table of components with SKU, barcode, quantity per kit, **total to pick** (per-kit x kits) and quantity available at the location, plus a tick box per line and a total-units row. Shortage lines are flagged. For disassembly the sheet lists what is returned to stock.
- Built as a plain HTML view with a print stylesheet (`@media print`) and `window.print()`; hide the app chrome when printing. Works from any valid or in-progress mix, so it can be printed before the Assemble button is enabled.
- Pure function in the domain layer builds the pick-list rows (unit tested); a Playwright test checks the print view contents.
- Optional later: a barcode for the kit SKU, and a "pick list printed" note in the adjustment `reason`.

### Phase 4c - Completed-box image

Show what the finished kit will look like, built from the product images of the chosen mini bars.

- Data: the mini bars have product images in Shopify. Read each component's image from Shopify (variant image, falling back to the product's featured image) in the same query as the variant search; mini bars that are unpublished still return images through the Admin API.
- Layout: a grid with one slot per bar in the kit, matching the physical boxes: 4-pack 1 x 4, 5-pack 1 x 5, 6-pack 1 x 6, 12-pack 2 x 6. Each chosen flavor fills as many slots as its quantity, in a stable order; unfilled slots show a placeholder until the mix reaches the kit size. 
- Fallbacks: a neutral placeholder tile for products with no image; lazy-load images and size them with Shopify's CDN image transforms.
- Reuse: the same composition appears on the pick list so the packer can match the box visually.
- Pure function maps a mix to an ordered list of slots (unit tested); the rendering is covered by Playwright.
- Later option: save the composed image as media on the kit product through the Admin API.

### Phase 5 - Disassemble UI

Location, kit and quantity, then the per-kit mini bar mix (multiplied by the kit count) with total validation.

### Phase 6 - Hardening

Playwright E2E tests on the dev store, security review, error and empty states, README.

### Phase 7 - Deploy

Once the host is chosen: infrastructure as code for the selected provider (a Compose file and bootstrap script for a Droplet), a CI/CD pipeline, a staging deploy against the dev store, then production. Update the Shopify app URLs and webhooks to the hosted domain.

### Later

Public-app work (billing, GDPR webhooks, app review), lots and expiry, cost rollup, saved templates, history UI.

## Risks

- **Concurrent stock changes.** A sale can change stock between validation and submit. Shopify rejects negative results; surface that error clearly, and consider the `changeFromQuantity` compare guard.
- **Untracked or unstocked items.** Handled by validation with clear messages.
- **Component types.** Exclude gift cards and similar non-physical items.
- **Disassembly mismatch.** Manual entry can return different contents than were assembled. Accepted for v1; the main argument for adding history later.
- **Shopify-only records.** No app-side history means audit relies on Shopify's inventory adjustment log.

## Open questions for the store team

- Pick list: should printing be optional, or required before the Assemble button works? Any fields the packers need (bin or shelf, lot, signature line)?
- Box image: do the mini-bar products already have good product images in Shopify? Is there a packaging or box photo to use as the background, and should the composed image ever be saved onto the kit product?
- Is one identical mix per run enough, or do they need different mixes per kit in a single run?
- Is there a usual assembly location, or should the location be chosen every time?
- Which option (AWS, GCP, DigitalOcean App Platform or Droplet), and who owns the account and deploys?
- Is anything missing on screen (cost, low-stock flavors, a printable pick list)?
