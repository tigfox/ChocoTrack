# Inventory Tracker - Plan and Status

A second section of ChocoTrack, and its main purpose: watch selected inventory against per-location targets, flag what is low, and suggest transfers between locations. The Sampler Builder (`sampler_builder.md`) stays as it is.

**Status (2026-11-13): plan agreed with the store team; no code written yet.** Phase I0 is next.

## Decisions (from the store team)

| Area | Decision |
|---|---|
| Purpose | Track selected inventory per location, show low stock, and suggest transfers. |
| Unit tracked | A **variant** (each variant has its own inventory record). One flavor can have a Full variant (about 400 bars) and a Mini variant (about 2000) with separate targets. The real store mixes variants and separate products; both work because every row is a variant. |
| Selection | A private **variant metafield flag** `choco_track.tracked` (true/false). Staff flag variants in the app or in the Shopify admin. Hidden from customers. |
| Targets | A **minimum and maximum per variant per location**, in a variant metafield `choco_track.targets` (JSON, keyed by location id). No app database for business data. |
| Count shown | **Available**, with **incoming** (stock in transit) shown beside it. Low means available is below the minimum. |
| Alerts | **In the app only**: a banner on the Inventory page and a count on the sidebar link. No email, Slack or background jobs in v1. |
| Transfers | The app **suggests** them. A button creates a **draft transfer in Shopify** for a person to review and mark ready. Nothing is created without a click. |
| Transfer sources | Locations designated as **sources** in Settings (for example Warehouse and Factory). Everything else is a destination. |
| Report layout | Rows are tracked variants down the left. Columns are stock locations across the top. Each cell shows the count and its target. |
| Locations | All active locations are columns. Staff can hide some; the choice is remembered per browser. |
| Editing | Inline, in the report table: the tracked flag, minimum and maximum. Shopify admin still works too. |
| Scale | Roughly 100 to 500 tracked variants and about four locations. Needs search, filters and paging in the table. |

## Screen: Inventory report

```
Inventory                                   [Suggest transfers (3)]   [Add products]
! 5 items are below their minimum  (Show only low)

Search...   Collection [All v]   [x] Low only   Locations: Warehouse, Factory, Market, Cafe [hide...]

Product / variant              |  Warehouse        |  Factory         |  Market Store    |  Cafe
-------------------------------+-------------------+------------------+------------------+---------------
Rum Caramel - Full             |  420  min 300/500 |  35  min 50/150  |  12  min 20/60   |  8  min 10/40
                               |                   |  +40 incoming    |                  |
Rum Caramel - Mini             |  2100 min 1500/2500| ...
```

- Each cell: the available count, then `min / max`, with incoming and draft quantities beneath when present.
- Cell state: **low** (below minimum, critical tone), **ok**, **over max** (subdued note), and **not tracked here** (dash) when no target is set for that location.
- Left column stays visible when scrolling across locations. Rows are grouped under the product name when a product has several tracked variants.
- An **Edit targets** mode swaps each cell for two number fields (min, max). Changes save per row.
- **Add products** opens a search (name, SKU, barcode, collection filter) with checkboxes that flag or unflag variants.

## Screen: Suggested transfers

Opened from the report. Grouped by origin to destination; each group lists variants and quantities, with **Create draft transfer in Shopify** per group (and one for all).

How a suggestion is worked out, per tracked variant per destination location:
1. If `available + incoming + in-draft < min`, the need is `max - (available + incoming + in-draft)`.
2. Sources are tried in the order set in Settings. A source can give only what it has above its own minimum, so a transfer never pushes a source below target.
3. If sources cannot cover the need, the suggestion shows the shortfall instead of hiding it.
4. Drafts the app created earlier (tagged `choco-track`) count as pending, so the same suggestion does not reappear after someone clicks the button.

## Screen: Settings additions

- Choose **source locations** and their order (stored in app-owned metadata on the app installation, not in a database).
- Nothing else is configured here in v1; targets live in the report.

## Technical design

- **Reads:** `productVariants` with each variant's `inventoryItem.inventoryLevels` quantities (`available`, `incoming`) per location, the two metafields, product title and image. Paged, then filtered to tracked variants on our side if Shopify cannot filter by a variant metafield (see risks).
- **Writes:** `metafieldsSet` for the flag and targets. The targets JSON is edited with `compareDigest` so two people editing the same variant cannot silently overwrite each other (the second gets a "changed, reload" message, like the stale-stock check in the sampler).
- **Transfers:** `inventoryTransferCreate`, which makes a **draft** and needs the `write_inventory_transfers` scope. In API 2026-07 it requires an idempotency key, so one key per click prevents double-creating. Drafts are read back with `inventoryTransfers` for the pending quantities.
- **Alerts:** computed when the page loads from the same read, so there is no scheduler. The sidebar count is computed in the app layout and cached briefly (about 60 seconds, in memory) so every page view does not cost a full read.
- **New scope:** `write_inventory_transfers` (and read access to transfers). Existing scopes already cover inventory and products. The store team approves it when the app updates, as with the earlier scope changes.
- **Same rules as the sampler:** the server never trusts ids or numbers from the browser (validated input, 64 KB body cap), errors show next to the person's work instead of replacing the page (`fetchJson`), and logs hold only error name and message.
- **Domain code stays pure and tested first:** targets parsing, status per cell, alert counts, and the suggestion engine live in `app/domain/` with no Shopify imports.

## Phases (TDD, 80%+ coverage; no browser tests unless asked)

| Phase | Work | State |
|---|---|---|
| I0 Spike | Confirm against the dev store: (a) can `productVariants` be filtered by the variant metafield `tracked`; (b) does the sidebar link support a count badge; (c) the new scope is granted after a dev update. Settles the fallbacks below. | Not started |
| I1 Domain | Parse and validate targets (whole numbers, `0 <= min <= max`), cell status, low-item counts, suggestion engine with source surplus and shortfalls. | Not started |
| I2 Shopify layer | Metafield definitions (created on first use), list tracked variants with quantities per location, set flag, save targets with `compareDigest`, read drafts, create draft transfer. Fake-client tests plus an opt-in live test that creates and deletes a throwaway draft. | Not started |
| I3 Report UI | Table with locations as columns, search, collection and low-only filters, banner, sidebar count, hidden-location memory, paging. | Not started |
| I4 Editing | Edit-targets mode, add and remove products, error and conflict messages. | Not started |
| I5 Suggestions and Settings | Source-location settings, suggested transfers screen, create draft transfer button. | Not started |
| I6 Hardening and deploy | Security pass on the new routes, plan and README updates, scope change in the production app config, deploy with the Droplet release. | Not started |

## Risks and open items

- **Variant metafield filter (checked in I0).** Shopify documents filtering by `metafields.{namespace}.{key}:{value}`, but earlier in this project variant search by metafield did not work. Fallbacks, in order: filter on a product-level mirror flag the app maintains; or read all variants in a collection and filter ourselves. With 100 to 500 tracked variants any of these is workable, but the read gets heavier.
- **Pending drafts.** Draft transfers do not count as incoming until marked ready, so the app adds its own drafts to the pending quantity. Drafts made by hand in Shopify are not counted unless tagged.
- **Source can itself be low.** Suggestions never take a source below its own minimum, so a low source simply shows a shortfall.
- **Deleted or renamed locations.** Targets for a location that no longer exists are ignored; they are never deleted automatically.
- **Alerts need someone to look.** With in-app alerts only, nobody is told while the app is closed. Email or Slack would need a scheduled job on the Droplet; that is a later step if wanted.
- **To confirm with the store team:** should Inventory be the app's home page (first in the sidebar and the landing page)? I assume yes, since it is the main purpose.

## Later

Email or Slack alerts from a scheduled job, a history of counts and trends, auto-marking transfers ready, reorder suggestions for supplier purchase orders.
