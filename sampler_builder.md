# Sampler Builder - Development Plan

A Shopify app that assembles "sampler kits" from mini chocolate bar inventory, using the Admin GraphQL [`InventoryItem`](https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryItem) and inventory adjustment APIs.

## Decisions

| Area | Decision |
|---|---|
| Kit model | Assembled/physical kits. Assembly consumes components and adds stock to the kit's InventoryItem. |
| Kit sizes | Two variants: **6-pack** and **12-pack**. Mini bars per kit must equal the kit size exactly. |
| Components | About 20 flavors of mini chocolate bar (the mockup uses 23 names taken from the River Sea Chocolates bar collection). Tracked in inventory, not sold individually. Any combination may go in a kit. |
| Recipe | None stored. Components and quantities are chosen at each assembly run (the same mix is built N times per run). |
| Kit SKU | An ordinary tracked variant. The app can create it or link an existing variant. |
| Disassembly | Returned components are entered manually. The total must equal kit size x kits. |
| Locations | Multi-location. Every run happens at a chosen location. |
| Component picker | Search by title, SKU or barcode (scanner-style Enter to add), with a collection filter (defaults to the mini-bar collection). |
| Records | Shopify only: no app-side business tables. Adjustment `reason` and `referenceDocumentUri` form the audit trail in Shopify's inventory history. |
| Surface | Embedded admin UI only. No storefront, POS or order webhooks in v1. |
| Stack | Shopify CLI React Router template (TypeScript, Polaris, App Bridge). Prisma only for OAuth session storage. |
| Distribution | Built for one store; no hardcoded shop so it can go public later. |
| Hosting | **Undecided - the store team chooses AWS or GCP.** Build cloud-portable so either works (see Hosting). |
| Deferred | Lots and expiry dates, cost rollup, templates, audit/history UI. |

## Key design points

1. **Atomic adjustments.** One `inventoryAdjustQuantities` call carries all changes: a negative line per component and one positive line for the kit. Either every line applies or none does, so there is no partial-failure cleanup. Use `name: "available"`, a `reason`, and a `referenceDocumentUri` such as `gid://choco-track/Assembly/<uuid>`. Disassembly is the mirror image.
2. **Idempotency.** Newer API versions require an idempotency key on this mutation. Confirm against current docs; generate one key per submit so a double-click or retry cannot assemble twice.
3. **Validation before the mutation.** Every item is tracked and stocked at the chosen location (activate the kit item with `inventoryActivate` if needed). Quantities are whole numbers, units per kit equal the kit size, stock is sufficient, and no component is also the kit. Max buildable is `min(floor(available / qtyPerKit))`.
4. **Kit creation.** The app creates a product/variant with tracked inventory via `productSet` or `productCreate`, or links an existing variant.
5. **Search.** `productVariants(query:)` with `sku:` and `barcode:` filters plus collection filtering. Inventory levels come from `inventoryItem.inventoryLevels`.
6. **Scopes.** `read_products`, `write_products`, `read_inventory`, `write_inventory`, `read_locations`.

## Hosting (AWS or GCP - pending store-team decision)

The app is a stateless Node web server plus a small database for Shopify OAuth sessions only (kit data lives in Shopify). That keeps either cloud simple.

**Portability rules from day one**
- Ship as a container image (the Shopify template includes a Dockerfile), configured only through environment variables.
- Prisma on PostgreSQL for session storage; no cloud-specific SDKs in the domain or service layers.
- Secrets (Shopify API key and secret, DB URL) come from the platform secret manager, never from the repo.
- Public HTTPS URL with a stable domain, because Shopify needs an app URL, OAuth redirect URLs and webhook endpoints (`app/uninstalled`, and the GDPR topics if the app goes public).
- A health-check endpoint, structured logs to stdout, and CI that builds, tests and pushes the image.

| Concern | AWS | GCP |
|---|---|---|
| Runtime | ECS Fargate (or App Runner) behind an ALB | Cloud Run |
| Database | RDS PostgreSQL (small) | Cloud SQL PostgreSQL (small) |
| Secrets | Secrets Manager | Secret Manager |
| Registry | ECR | Artifact Registry |
| Logs | CloudWatch | Cloud Logging |
| IaC | Terraform | Terraform |

Cloud Run and App Runner are the lowest-effort options for a low-traffic internal app. Questions for the store team: any existing cloud account or compliance constraints, who owns billing and deploys, and whether a staging environment is needed.

## Phases (TDD, 80%+ coverage)

### Phase 0 - Clickable mockup for store-team feedback  *(built; awaiting feedback)*

A standalone React + Vite + TypeScript app in `/mockup`, using real Polaris (React) components, fake data and no backend, served by nginx in Docker on this laptop (`docker compose up --build`, http://localhost:8080).

- Screens: Assemble, Disassemble, Create kit, and the result states (success, shortage, not stocked, stale-stock conflict).
- Pure domain logic (`src/domain`) is unit-tested and is meant to carry over into the real app.
- `mockup/WALKTHROUGH.md` holds the feedback scenarios and questions.
- **Gate:** Phase 1 starts only after the store team signs off. Feedback changes go into the mockup first, then into this plan.

Known caveat: `@shopify/polaris` (React) is deprecated in favor of Polaris web components. Fine for the mockup; choose the real app's UI library at Phase 1.

### Phase 1 - Shopify app scaffold

- Create a Partner account and a development store with sample products across several locations.
- Scaffold with `shopify app init`; commit.
- Check current docs for dev-store creation, API version and `@idempotent` requirements.

### Phase 2 - Domain core

Move `mockup/src/domain` into the app (or a shared package) and adjust for any feedback. Pure functions, no network.

### Phase 3 - Shopify service layer

A repository-style wrapper around the GraphQL calls (locations, variant search, levels, adjust, activate, create kit) with `userErrors` mapped to friendly messages. Integration-tested against mocked responses.

### Phase 4 - Assemble UI

Wire the approved mockup screens to the service layer: location, kit pick/create, mix picker, live max buildable, submit with success or error banner.

### Phase 5 - Disassemble UI

Location, kit and quantity, then the returned mini bars with total validation.

### Phase 6 - Hardening

Playwright E2E tests on the dev store, security review, error and empty states, README.

### Phase 7 - Deploy

Once the cloud is chosen: Terraform for the selected provider, a CI/CD pipeline, a staging deploy against the dev store, then production. Update the Shopify app URLs and webhooks to the hosted domain.

### Later

Public-app work (billing, GDPR webhooks, app review), lots and expiry, cost rollup, saved templates, history UI.

## Risks

- **Concurrent stock changes.** A sale can change stock between validation and submit. Shopify rejects negative results; surface that error clearly, and consider the `changeFromQuantity` compare guard.
- **Untracked or unstocked items.** Handled by validation with clear messages.
- **Component types.** Exclude gift cards and similar non-physical items.
- **Disassembly mismatch.** Manual entry can return different contents than were assembled. Accepted for v1; the main argument for adding history later.
- **Shopify-only records.** No app-side history means audit relies on Shopify's inventory adjustment log.

## Open questions for the store team

- Is one identical mix per run enough, or do they need different mixes per kit in a single run?
- Should full-size bars ever be allowed as kit contents?
- Is there a usual assembly location, or should the location be chosen every time?
- Which cloud, AWS or GCP, and who owns the account and deploys?
- Is anything missing on screen (cost, low-stock flavors, a printable pick list)?
