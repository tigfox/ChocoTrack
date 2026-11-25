# Sampler Builder - Development Plan

A Shopify app that assembles "sampler kits" from mini chocolate bar inventory, using the Admin GraphQL [`InventoryItem`](https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryItem) and inventory adjustment APIs.

## Status (2026-11-25)

### Session handoff (read this first)

**State:** everything from the 2026-11-24/25 session is merged to `main` (PRs #19 to #28) and **deployed** at `https://chocotrack.franson.nyc`. The only open PRs are four old Dependabot bumps (#13, #14, #15, #17; see "Security review"). Working tree clean; 731 unit tests, 22 browser tests passing against the deployed app.

**What changed in this session** (details in `river_sea_refactor_plan.md` and `inventory_tracker.md`):
- **River Sea product structure.** Mini categories are one product with a variant per flavor; kit size and category now live on the **variant**; Settings can **use an existing product as a kit**; flavors show friendly names with the category under them.
- **Pack Size groups** replace the by-name "send in multiples of" (default 1, groups of variants with their own size; stored by variant id).
- **Inventory:** per-variant **Untracked** checkbox (hidden, no alerts, no transfers, targets kept); a warning before "Done editing" drops unsaved rows; "Add products" is sorted by title with Show more.
- **Dev tooling:** `scripts/import-river-sea.mjs` rebuilds a development store from the live-store exports (refuses non-dev stores, needs `--confirm=<store>` to delete); old seed scripts removed.
- **Tests:** the browser suite runs against the deployed app (`APP_HANDLE=chocotrack-production npm run test:e2e`) and now **fails on JavaScript errors** it sees in the browser. Run it from a Chrome started with `--remote-debugging-port=9222` and a **separate profile**; do manual testing in a different window, because the Assemble picker remembers its collection per browser.

**Next session starts with the live store.** The store team is working through `StoreTasks.pdf` (in `/Users/tigfox/Documents/River Sea/`, not in the repo): tracking and counts for the 27 mini flavors, tracking for 4 sampler products, collections, two SKU clean-ups. Then: install on the live store (custom distribution), first-time setup in the app, a careful first assemble/disassemble on real stock. Developer jobs still to do (not built): a **read-only live-store readiness check** (tracking on, collections present, SKUs unique, kits trackable) and a one-off to **apply the 25 flavor display names** to the live store (the importer refuses non-dev stores by design). Watch for: the pack size groups, Inventory targets and kits start **empty** on a new install.

**Dev store (`creeklakeconfections`) as left:** River Sea catalog imported; minis 1500 each at Factory; 12-bar and 6-bar single-origin kits set up; **no pack size groups yet**; 29 products flagged for Inventory with targets for the 60g bars at Cafe and Market Store (set by hand during testing).


**Built and working in the dev store (`creeklakeconfections`):** Assemble, Disassemble, Settings (kits and categories), search with collection filter, printable pick list, finished-box preview with product images, remembered location, kit and collection, and error handling for dropped connections and stale stock. The mockup is frozen.

**Checks:** 731 unit and render tests (99% lines; gate is 80%), typecheck, lint and build clean, an opt-in live test against the dev store (7 tests), and 22 browser tests (`npm run test:e2e`, which also fails on browser JavaScript errors). CI on GitHub passes on every push to `main` with pinned action versions.

| Phase | State |
|---|---|
| 0 Mockup | Done, signed off, frozen |
| 1-3 Scaffold, domain, Shopify service layer | Done |
| 4, 4b, 4c Assemble UI, pick list, box image | Done |
| 5 Disassemble UI | Done |
| 6 Hardening | Done (see below for what stays open) |
| Feedback round 2 (Settings page, kit categories) | Done |
| Error and edge-case pass | Done |
| 7 Deploy | **Live and hardened (2026-11-24).** `https://chocotrack.franson.nyc` on a 512 MB Ubuntu 26.04 Droplet (192.241.157.72), Let's Encrypt certificate, automatic builds from `main` and a gated deploy by image digest through a restricted SSH key. Production Shopify app "ChocoTrack Production" is released on the real hostname. The store owner tested Inventory, Assemble, Disassemble, Settings and printing on it in the dev store (all good). Left: store-team acceptance testing, custom distribution, a larger Droplet |
| River Sea structure and Inventory follow-ups (2026-11-24 to 25) | **Done and deployed** (PRs #19 to #28): variant-level kits, link existing product as a kit, flavor names, Pack Size groups, Untracked switch, unsaved-rows warning, importer |
| Security review | **Done 2026-11-23 to 24** (app code, CI/CD, host). Fixes shipped; deferred items are listed under "Security review" below |

**Next, in order:** (1) **store-team tasks on the live store** (`StoreTasks.pdf`: tracking, counts, collections, SKU clean-ups); (2) **install on the live store** with custom distribution (Dev Dashboard, the app's Distribution page: enter the store's `.myshopify.com` domain, generate the install link, install as owner or staff who can install apps; the choice is one-way, so confirm the store first); (3) **first-time setup in the app** (kits, transfer sources, Pack Size groups, Inventory targets) and a careful first assemble then disassemble on real stock; (4) before real staff use, a Droplet with 1 GB or more RAM; (5) developer jobs: the read-only **live-store readiness check** and applying the **flavor display names** to the live store; (6) **barcode sheet printing** (planned; three questions for the owner under "Future development"); (7) the deferred security items (second dev store to test cross-shop isolation live) and the held-back dependency upgrades (see "Security review"); (8) optional fake-Shopify browser suite in CI; (9) ask the store team whether the screens feel faster, then discuss deferred features.

## Decisions

| Area | Decision |
|---|---|
| Kit model | Assembled/physical kits. Assembly consumes components and adds stock to the kit's InventoryItem. |
| Kit sizes | Each kit has its own size, **any whole number from 1 to 48** (typed on the Settings page; it was a fixed list of 4, 5, 6 and 12 before 2026-11-17). Mini bars per kit must equal the kit size exactly. |
| Components | About 20 flavors of mini chocolate bar (the mockup uses 23 names taken from the River Sea Chocolates bar collection). Tracked in inventory, not sold individually. Any combination may go in a kit. |
| Recipe | None stored. Components and quantities are chosen at each assembly run (the same mix is built N times per run). |
| Kit SKU | An ordinary tracked variant. The app can create it, or link an existing variant (Settings, "Use an existing product as a kit"). The kit size and category are variant metafields, so one product can hold kits of different sizes. |
| Disassembly | The mini bars in one kit are entered manually (they must equal the kit size); returned stock is that mix x the number of kits. |
| Locations | Multi-location. Every run happens at a chosen location. |
| Component picker | Search by title, SKU or barcode (scanner-style Enter to add), with a collection filter (defaults to the mini-bar collection). |
| Records | Shopify only: no app-side business tables. Adjustment `reason` and `referenceDocumentUri` form the audit trail in Shopify's inventory history. |
| Pick list | A printable pick list is available before any change is saved: what to pull from stock, how many of each, from which location. Printing is optional and never changes inventory. |
| Box image | The assemble screen shows an image of the finished box, composed from the Shopify product images of the chosen mini bars. |
| Surface | Embedded admin UI only. No storefront, POS or order webhooks in v1. |
| Stack | Shopify CLI React Router template (TypeScript, Polaris, App Bridge). Prisma only for OAuth session storage. |
| Distribution | Built for one store; no hardcoded shop so it can go public later. |
| Hosting | **Initial: one small DigitalOcean Droplet** (Docker Compose, Caddy for HTTPS, SQLite sessions on disk; runbook in `deploy/droplet/`). May move to a larger platform (AWS, GCP, App Platform) if the app grows; the container stays portable (see Hosting). |
| Kit settings | A Settings page lists the kits and edits name, size and optional category; it also creates kits. Price, SKU and barcode stay in Shopify. |
| Kit category | Optional, one per kit, an existing store collection, kept in the `choco_track.category` metafield on the kit **variant**. Assembling or disassembling that kit starts the mini-bar list on it. With the River Sea data each mini category product has its own collection (`Limited Editions`, `Dark Milks`, `Rare`, ...) |
| Pack sizes | A default (1) plus groups; each group has a pack size and the specific variants in it; a variant is in at most one group; nothing is matched by name. Stored by variant id with the app installation. Transfer suggestions round to whole packs. |
| Untracked variants | A per-variant Untracked checkbox on Inventory (variant metafield `choco_track.untracked`): hidden by default, left out of alerts, the sidebar count and transfers; targets kept. |
| Deferred | Lots and expiry dates, cost rollup, templates, audit/history UI. |

## Key design points

1. **Atomic adjustments.** One `inventoryAdjustQuantities` call carries all changes: a negative line per component and one positive line for the kit. Either every line applies or none does, so there is no partial-failure cleanup. Use `name: "available"`, a `reason`, and a `referenceDocumentUri` such as `gid://choco-track/Assembly/<uuid>`. Disassembly is the mirror image.
2. **Idempotency.** Newer API versions require an idempotency key on this mutation. Confirm against current docs; generate one key per submit so a double-click or retry cannot assemble twice.
3. **Validation before the mutation.** Every item is tracked and stocked at the chosen location (activate the kit item with `inventoryActivate` if needed). Quantities are whole numbers, units per kit equal the kit size, stock is sufficient, and no component is also the kit. Max buildable is `min(floor(available / qtyPerKit))`.
4. **Kit creation.** The app creates a product/variant with tracked inventory via `productSet` or `productCreate`, or links an existing variant.
5. **Search.** `productVariants(query:)` with `sku:` and `barcode:` filters plus collection filtering. Inventory levels come from `inventoryItem.inventoryLevels`.
6. **Scopes.** `read_products`, `write_products`, `read_inventory`, `write_inventory`, `read_locations`, plus `read_inventory_transfers` and `write_inventory_transfers` for the Inventory section.

## Hosting (decided: a DigitalOcean Droplet to start; the options below were the comparison)

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

*Done:* copied to `choco-track/app/domain` (types, stock, validate, apply, search, counts, box, pickList) with their tests, Vitest and a coverage threshold of 80%. The mockup's `workflow.ts` (stale-stock simulation) stays mockup-only. The mockup is frozen (reference only), so its copy of the domain is intentionally not kept in sync.

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

*Built (awaiting a manual check in the dev store):* `/app/assemble` loads locations, collections, kits and kit stock; the mix picker searches Shopify server-side (`/app/api/search`, debounced, name/SKU/barcode plus collection); submit posts JSON to the route action, which re-reads variants from Shopify (kit sizes and inventory item ids are never taken from the browser), validates, and calls `submitRun`. Create-a-kit posts to `/app/api/kits`. Untrusted JSON is validated in `app/lib`. Box preview, optional print sheet and result banners are ported from the mockup. Known limits: search returns the first 50 matches (no paging), and the collection filter defaults to "All items".

### Phase 4b - Printable pick list (before saving)

A **Print pick list** action next to Assemble (and Break down) that opens a print-ready sheet without changing inventory, so the team can pull stock first and submit afterwards.

- Contents: date, location, kit (title, SKU), number of kits, and a table of components with SKU, barcode, quantity per kit, **total to pick** (per-kit x kits) and quantity available at the location, plus a tick box per line and a total-units row. Shortage lines are flagged. For disassembly the sheet lists what is returned to stock.
- Built as a plain HTML view with a print stylesheet (`@media print`) and `window.print()`; hide the app chrome when printing. Works from any valid or in-progress mix, so it can be printed before the Assemble button is enabled.
- Pure function in the domain layer builds the pick-list rows (unit tested); a Playwright test checks the print view contents.
- Optional later: a barcode for the kit SKU, and a "pick list printed" note in the adjustment `reason`.

### Phase 4c - Completed-box image

Show what the finished kit will look like, built from the product images of the chosen mini bars.

- Data: the mini bars have product images in Shopify. Read each component's image from Shopify (variant image, falling back to the product's featured image) in the same query as the variant search; mini bars that are unpublished still return images through the Admin API.
- Layout: a grid with one slot per bar in the kit, matching the physical boxes: up to 6 bars is one row (4-pack 1 x 4, 6-pack 1 x 6); larger kits fill rows of 6 (12-pack 2 x 6, 8-pack 2 x 6 with the last slots empty). Each chosen flavor fills as many slots as its quantity, in a stable order; unfilled slots show a placeholder until the mix reaches the kit size. 
- Fallbacks: a neutral placeholder tile for products with no image; lazy-load images and size them with Shopify's CDN image transforms.
- Reuse: the same composition appears on the pick list so the packer can match the box visually.
- Pure function maps a mix to an ordered list of slots (unit tested); the rendering is covered by Playwright.
- Later option: save the composed image as media on the kit product through the Admin API.

### Phase 5 - Disassemble UI

Location, kit and quantity, then the per-kit mini bar mix (multiplied by the kit count) with total validation.

*Built:* `/app/disassemble` reuses the assemble screen (`KitRunView`, mode-specific wording and rules in `runModes.ts`) and the same tested server handler (`handleRun`), which rejects a request posted to the wrong page. Awaiting a manual check in the dev store.

### Phase 6 - Hardening

Browser tests on the dev store, security review, error and empty states, README.

*Done so far:* independent security review (no critical or high findings) and the fixes it raised: a request whose "kit" is not a real kit, or lists the kit as its own component, is refused; activation of stock levels is decided from live Shopify data (the browser snapshot is only the stale-stock guard); duplicate-SKU check when creating a kit; request body capped at 64 KB and mix size limited; search operators stripped; error logging reduced to name and message; `.dockerignore` extended; dev MCP pinned. Also: "Show more" search paging (up to 250), empty states, mandatory privacy webhooks (take effect on `shopify app deploy`), Dependabot config, root README. The live test now runs through the real server handler, including a stale-snapshot refusal.

*Resolved since:* browser tests now exist (`choco-track/e2e/`, Playwright attached to a signed-in Chrome over a debugging port; run with `npm run test:e2e`, see `e2e/README.md`; not part of CI because they need a signed-in session). The container runs as a non-root user.

*Still open:*
- Per-shop rate limiting, if the app goes public.
- Confirm `application_url`, redirect URLs and webhook `api_version` (`2027-01` from the template) at deploy.
- Optional: a fake-Shopify browser suite so UI behavior is also checked in CI.

### Store-team feedback round 2 (Done)

- Kit creation moved off the Assemble page to a new **Settings** page (sidebar, under Assemble and Disassemble). Settings lists every kit and lets the store team change its name, size and category, and create a kit.
- **Category** is optional per kit and is one of the store's existing collections (for example Dark chocolate, Milk chocolate). It is stored on the kit product as the `choco_track.category` collection-reference metafield, so the app still keeps no records of its own. Assembling or disassembling a kit that has one starts the mini-bar list on that collection; staff can still change the filter.
- Fixed along the way: the "All items" collection option was reported as the text "All items" (an empty `s-option` value is reported by its label), so it was not remembered. Empty choices now use a real value.
- Browser tests (`npm run test:e2e`, logged-in Chrome over CDP) cover Settings, categories and the filter.

### Error and edge-case pass (Done)

- **Dropped connection:** a lost network during a submit, a settings save or a search used to replace the whole page with an "Application Error" and lose the mix. These calls now go through `fetchJson` (JSON routes under `/app/api/`), so the failure shows next to the work. A submit that cannot be confirmed keeps the mix and the run id, so retrying is safe and applies once.
- **Shopify errors around a run:** a failure while reading the catalog before a run is now an error result, not an exception; a failed stock refresh after a successful run no longer makes the success look like a failure.
- Related fix: `inventoryActivate` needs an idempotency key in API 2026-07, so brand-new kits could not be assembled at a location they were not yet stocked at. A live regression test now creates, assembles, disassembles and deletes a throwaway kit.
- Browser tests added for: dropped connection (submit, settings, search), stale stock changed in Shopify, bar not stocked at a location, more kits than stock allows, duplicate SKU.

### Phase 7 - Deploy  *(done 2026-11-18: running on the Droplet; distribution, hostname and sizing still to do)*

Target: a small DigitalOcean Droplet. Everything is in `deploy/droplet/` with a step-by-step runbook (`README.md`).

- **Image:** `choco-track/Dockerfile` runs as a non-root user, keeps the SQLite session database on a mounted `/data` volume, runs `prisma migrate deploy` on start, and has a healthcheck on `GET /healthz`. Built and run locally with placeholder Shopify values: migrations applied, health 200, container reported healthy.
- **Stack:** `docker-compose.yml` (app plus Caddy with automatic HTTPS), `Caddyfile`, `.env.example`. Compose and Caddy configs validated.
- **Server scripts:** `bootstrap.sh` (admin account with a key, key-only SSH with no root login, Docker, firewall, fail2ban, unattended upgrades including Docker packages with a 04:00 reboot when needed, swap, the `deploy` user, a block on the cloud metadata address), `deploy.sh` (pull by digest, restart, wait for healthy, record in `releases.log`, roll back if unhealthy or by sha), `ci-entry.sh` (the CI key's forced command), `backup.sh` (daily SQLite backup from root's cron, mode 600, 14 days), and `push-stack.sh` (installs stack changes from an admin's laptop). The scripts live root-owned in `/usr/local/lib/chocotrack`.
- **CI/CD:** `.github/workflows/ci.yml` runs typecheck, lint, tests with the coverage gate and build, then on `main` builds `ghcr.io/tigfox/chocotrack:<sha>` and, after the `production` environment's reviewer approves, runs `deploy <sha> <digest>` over a key that can do nothing else. CI no longer copies files to the host. `main` has a ruleset (pull request and code-owner review, no force push or deletion; the owner keeps the admin bypass), `.github/CODEOWNERS`, SHA-pinned actions, Dependabot (npm, docker, docker-compose, actions) and secret scanning with push protection.
- **Containers:** the app and Caddy run read-only with all capabilities dropped (Caddy keeps only `NET_BIND_SERVICE`), `no-new-privileges` and a PID limit; `/app` is root-owned; the app, Caddy and the Node base image are pinned by digest; Caddy has `admin off`, extra headers and returns 401 for `/webhooks/*` without a Shopify signature header.
- **Database decision:** SQLite on the Droplet for now. It holds only OAuth sessions, so a separate PostgreSQL server would only use memory on a small VM. Moving to a platform without a persistent disk means switching the Prisma datasource to PostgreSQL; sessions are disposable, so no data migration.
- **Done 2026-11-17 to 18:** bootstrap on Ubuntu 26.04.1 (Docker's apt repo supports the codename), image pulled anonymously from the public ghcr package (linked to this repo; only this repo has access), deploy key and the four secrets in the GitHub `production` environment (the deploy job runs in that environment, so repository-level secrets are not used), the production Shopify app created with "Create app manually", its config completed (scopes, webhooks, `/auth/callback`, API `2026-07`) and released, real credentials in the server's `.env`, and the app installed and working in the dev store.
- **Done 2026-11-23 to 24:** the real hostname `chocotrack.franson.nyc` (Caddy re-issued the certificate; the Shopify config was released with the new URLs, so the sslip.io redirect is gone), the blank public index page, the security review and its fixes (below), React 19 and the Node 26 base image, and the owner's test pass of every screen and printing on the hardened stack.
- **Lessons:** keep `/opt/chocotrack/data` owned by uid 1000 (a recursive chown to `deploy` stops the app; on this Droplet uid 1000 is the `ubuntu` account); the CLI names the config after the app (`chocotrack-production`, not `production`); the linked config starts with empty scopes and no webhooks; the app's sign-in path is `/auth/callback`; `docker compose exec` swallows a script piped over SSH unless it gets `</dev/null`; failed SSH logins from your own IP trigger fail2ban (about ten minutes); app routes answer 410 to requests without a Shopify session token, which is normal.
- **Left to do:** custom distribution for the live store (after acceptance testing); a Droplet with 1 GB or more RAM (512 MB used about 190 MB of swap while idle); rotate the root password if it is still the one shared in chat (root login is now off, so it is housekeeping).

### Security review (2026-11-23 to 24)

Three read-only reviews (app code, CI/CD and secrets, the live host through `dropaudit.sh`) plus light active tests against the live host (forged webhooks, unauthenticated API calls, hostile `?shop=` values, TLS and header checks). Nothing critical or high in the app; the weaknesses were in delivery and hosting.

**Fixed:** root and password SSH login (was enabled, with no admin key installed); a world-readable session database and backups that never ran; app container could reach the cloud metadata endpoint; writable `/app` and no container hardening; unrestricted CI key that was root-equivalent through the docker group; images pulled by mutable tag; the template login form on the public home page; unvalidated `scopes_update` webhook payload; stale redirect URLs on a third-party hostname; docs that claimed hardening that was not there.

**Deliberately deferred (decided 2026-11-24, revisit after store-team acceptance testing):**
- Test cross-shop isolation live; this needs a second dev store, so it is only reviewed in code today.
- Held-back dependency majors, with `dependabot.yml` told to skip them: Prisma 7 (`@shopify/shopify-app-session-storage-prisma` 11.0.4 peers on Prisma 6), React Router 8 (`@shopify/shopify-app-react-router` peers on 7), ESLint 10 (needs a flat-config migration and a newer typescript-eslint). `npm audit` reports 7 findings in Prisma's CLI chain and build tooling, none reachable from a request.
- The owner keeps the admin bypass on the `main` ruleset (sole maintainer, so no second reviewer); the `production` environment reviewer is the human gate and may approve their own deploys.
- Low items from the app review: derive the draft-transfer idempotency key server-side (two clicks with different keys can create duplicate drafts), optional webhook replay de-duplication, restrict `runId` and the transfer key to a safe character set.
- Not done: image signing with cosign (needs cosign on the host; the digest pin covers a swapped tag), a rootless Docker or sudo-rule deploy user, and the `ubuntu` account (still holds uid 1000, so the container user owns `data/` as "ubuntu").

Re-run `dropaudit.sh` after any host change and compare with the last result.

### Future development (planned, not started)

#### Barcode sheet printing

Print scannable barcodes for the store's SKUs from inside the app. **Not built.** Today the only output is two one-off HTML files made outside the app from `Mini SKUs.csv` (`Mini_Barcodes.html`, a table, and `Mini_SKU_Pages.html`, one page per category), kept in `/Users/tigfox/Documents/River Sea/`. The pages and layout in `Mini_SKU_Pages.html` were approved and are the target: the category as the title, and each flavor's barcode, name and SKU spaced evenly down a letter-size page.

**Plan** (tests first, then code, then review, one PR; same process as the rest of the app):
1. **Pure helpers (tested), in `app/lib/`:** group variants by category product (the `Mini Bars - X` product that holds the flavors), and build a Code 128 SVG for a SKU with `bwip-js` (a new dependency, rendered in the browser, nothing stored). Validate SKUs: blank or unsupported characters are reported, never drawn as an empty barcode.
2. **New route `app/barcodes`** (Settings-style page, link in the sidebar). It reads variants through the same lookup as the pickers and offers a collection or category choice; the minis are the default.
3. **Layout:** one page per category, title plus flavors spaced evenly. Names come from the existing display-name logic (`variantNames`), so the sheet says "Bolivia 72%" and not the slug, with the SKU printed as text under each bar. It reuses the existing print stylesheet (`#print-root`, as the pick list does) and a **Print** button; pages break per category.
4. **Sidebar link and docs.**
5. **Browser test:** open the page, check a barcode renders for a known SKU (for example `MIN-BOL-RAR`), and that variants with no SKU are handled as decided below.

**Open questions (owner to decide before building):**
- [ ] Variants with no SKU: skip them, or list them on the sheet with a "no SKU" warning?
- [ ] Printing: a Print button per category as well as one for the whole set?
- [ ] Beyond the minis: should the page offer other collections, such as the 60g bars (only some have SKUs)?

**Dependencies and notes:**
- The sheets need SKUs in the store. The `MIN-…` SKUs were added to the **dev** store only (by the importer); the live store's mini variants have none, so they must be added there first (or the sheets will show "no SKU" for every mini).
- Format: Code 128 (the SKUs are alphanumeric, so they cannot be UPC or EAN). GTINs such as `850092274243` exist only on some variants and would be a separate option (UPC-A) if ever wanted.
- A scannable size matters: keep bars wide enough and keep the quiet zones; the reference pages use `bwip-js` scale 3, height 14 mm.
- Rendering in the browser keeps the app database-free (the print path is the same one the pick list uses).

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
