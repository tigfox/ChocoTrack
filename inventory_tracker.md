# Inventory Tracker - Plan and Status

A second section of ChocoTrack, and its main purpose: watch selected inventory against per-location targets, flag what is low, and suggest transfers between locations. The Sampler Builder (`sampler_builder.md`) stays as it is.

**Status (2026-11-13): plan agreed with the store team. Phase I0 (spike) is done and changed one decision: the tracking flag moves from the variant to the product (see below). No application code written yet; Phase I1 (domain logic) is done; Phase I2 (Shopify layer) is done; Phase I3 (report UI) is next.**

## Decisions (from the store team)

| Area | Decision |
|---|---|
| Purpose | Track selected inventory per location, show low stock, and suggest transfers. |
| Unit tracked | A **variant** (each variant has its own inventory record). One flavor can have a Full variant (about 400 bars) and a Mini variant (about 2000) with separate counts and targets. The real store mixes variants and separate products; both work because every row is a variant. |
| Selection | A private **product metafield flag** `choco_track.tracked` (true/false), set from the app or the Shopify admin, hidden from customers. Shopify can only search by a metafield on products, not on variants (found in Phase I0), so the flag sits on the product. A variant is **tracked** once it has a target at one or more locations, so Full and Mini variants of the same flavor are still tracked separately: set targets on the Mini variant and leave the Full variant empty if only minis matter. |
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
- **Add products** opens a search (name, SKU, barcode, collection filter) with checkboxes that flag or unflag products, then shows that product's variants so targets can be set. Variants of a flagged product that have no targets are hidden by default; a **Show variants without targets** toggle reveals them.
- A product flagged a few seconds ago may not appear in Shopify's search yet (about 10 seconds). The app adds it to the table straight away so nothing looks lost.

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

- **Reads:** `products(query: "metafields.choco_track.tracked:true")` (needs the flag definition to be filterable, which the app creates on first use), with each product's variants, their `inventoryItem.inventoryLevels` quantities (`available`, `incoming`) per location, and the targets metafield, in one paged query. Then keep only variants that have targets.
- **Writes:** `metafieldsSet` for the product flag and the variant targets. The targets JSON is edited with `compareDigest` so two people editing the same variant cannot silently overwrite each other (the second gets a "changed, reload" message, like the stale-stock check in the sampler).
- **Transfers:** `inventoryTransferCreate`, which makes a **draft** and needs the `write_inventory_transfers` scope. In API 2026-07 it requires an idempotency key, so one key per click prevents double-creating. Drafts are read back with `inventoryTransfers` for the pending quantities.
- **Alerts:** computed when the page loads from the same read, so there is no scheduler. The sidebar count is computed in the app layout and cached briefly (about 60 seconds, in memory) so every page view does not cost a full read.
- **New scopes:** `read_inventory_transfers` and `write_inventory_transfers`. Reading transfers is denied without the read scope (confirmed in I0). Existing scopes already cover inventory and products. The dev store did not prompt for permissions on the earlier scope change; confirm the same here in I2. At production deploy the store team approves them.
- **Sidebar count:** Shopify's nav accepts plain links only (no badge), so the count goes in the link text, for example "Inventory (5)".
- **Same rules as the sampler:** the server never trusts ids or numbers from the browser (validated input, 64 KB body cap), errors show next to the person's work instead of replacing the page (`fetchJson`), and logs hold only error name and message.
- **Domain code stays pure and tested first:** targets parsing, status per cell, alert counts, and the suggestion engine live in `app/domain/` with no Shopify imports.

## Phases (TDD, 80%+ coverage; no browser tests unless asked)

| Phase | Work | State |
|---|---|---|
| I0 Spike | Done 2026-11-13. See results below. | **Done** |
| I1 Domain | Done 2026-11-13. Pure, tested logic in `app/domain/`: `targets.ts` (parse, validate, serialize, set), `tracking.ts` (cell status, low-item summary, flagged products without targets), `suggest.ts` (transfer suggestions). 48 new tests, no Shopify calls. | **Done** |
| I2 Shopify layer | Done 2026-11-13. `app/shopify/trackedCatalog.ts` (read the report), `inventoryWrites.ts` (flag, save targets with the conflict guard, create draft transfer, save source locations, search products to flag). Unit tests plus a live test against the dev store. The two transfer scopes are added to the app config. Creating draft transfers could only be unit-tested (the CLI token has no transfer scope); it is verified through the running app. | **Done** |
| I3 Report UI | Table with locations as columns, search, collection and low-only filters, banner, sidebar count, hidden-location memory, paging. | Not started |
| I4 Editing | Edit-targets mode, add and remove products, error and conflict messages. | Not started |
| I5 Suggestions and Settings | Source-location settings, suggested transfers screen, create draft transfer button. | Not started |
| I6 Hardening and deploy | Security pass on the new routes, plan and README updates, scope change in the production app config, deploy with the Droplet release. | Not started |

## Phase I1 behavior (as built)

- **Targets:** whole numbers with `0 <= min <= max <= 1,000,000`. Saved JSON is read leniently (bad entries dropped, never an error) and written with sorted keys, so the same targets always produce the same text. No targets left means the metafield is removed.
- **Cell status:** `low` when available is below the minimum, `over` above the maximum, `ok` otherwise (both bounds inclusive), `untracked` when there is no target. A location that does not stock the item counts as 0 available, so it is low whenever the minimum is above 0. A low cell is marked **covered** when incoming plus pending stock reach the minimum, so the report can say "low, restock on the way".
- **Alert summary:** counts variants with any low location, low cells, and variants not yet covered. The sidebar count uses the variant count.
- **Suggestions:** per variant and destination, if `available + incoming + pending` is below the minimum, the need is `max - that total`. Sources are tried in the configured order, and each can give only what it has above its own minimum. A source with no target for the variant can give all of its stock, so give every source a target if it should keep a floor. Source locations are never destinations, even when low. Destinations are served in location order, so an earlier one gets first call on a shared source. What no source can cover is reported as a **shortfall**, flagged when the destination is still below its minimum afterwards. One suggested transfer per origin and destination, with a line per variant.

## Phase I0 results (2026-11-13, dev store)

| Question | Result |
|---|---|
| Can variants be searched by a variant metafield? | **No.** Shopify refuses the "filterable" setting on variant metafield definitions, and a variant search with a metafield filter silently ignores it and returns unrelated variants. So the flag cannot live on the variant. |
| Can products be searched by a product metafield? | **Yes**, once the definition is created as filterable: the filter returned exactly the flagged product. A newly set flag took about 10 seconds to appear in search. |
| Are incoming quantities readable? | **Yes.** `available`, `incoming` and `on_hand` come back per location in the same read as the variants. |
| Can transfers be read or created? | Reading is denied without `read_inventory_transfers`; creating needs `write_inventory_transfers` (and, from API 2026-04, an idempotency key). Both scopes will be added. |
| Can the sidebar link show a count badge? | **Not documented.** The nav is plain links; the count goes in the link text. |
| Is the new scope granted automatically in the dev store? | **Not yet checked.** It needs the app to change scopes, which I held back until code uses it. Confirm in I2. |

The spike created and deleted its test definitions and metafields; the dev store has no leftovers.

## Risks and open items

- **Flag on the product, targets on the variant.** A flagged product's variants all appear as candidates; only those with targets are tracked. If staff flag a product but never set targets, it shows nothing by default, so the report explains this with a banner ("2 flagged products have no targets yet").
- **Pending drafts.** Draft transfers do not count as incoming until marked ready, so the app adds its own drafts to the pending quantity. Drafts made by hand in Shopify are not counted unless tagged.
- **Source can itself be low.** Suggestions never take a source below its own minimum, so a low source simply shows a shortfall.
- **Deleted or renamed locations.** Targets for a location that no longer exists are ignored; they are never deleted automatically.
- **Alerts need someone to look.** With in-app alerts only, nobody is told while the app is closed. Email or Slack would need a scheduled job on the Droplet; that is a later step if wanted.
- **To confirm with the store team:** should Inventory be the app's home page (first in the sidebar and the landing page)? I assume yes, since it is the main purpose.

## Later

Email or Slack alerts from a scheduled job, a history of counts and trends, auto-marking transfers ready, reorder suggestions for supplier purchase orders.
