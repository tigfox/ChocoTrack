# Inventory Tracker - Plan and Status

A second section of ChocoTrack, and its main purpose: watch selected inventory against per-location targets, flag what is low, and suggest transfers between locations. The Sampler Builder (`sampler_builder.md`) stays as it is.

**Status (2026-11-24): all development is done, the app is live and hardened at `https://chocotrack.franson.nyc`, and the owner has tested Inventory, Assemble, Disassemble, Settings and printing on it in the dev store (all good). Next is acceptance testing by the store team using the checklist below.** Phases I0 to I6 (2026-11-13) plus the follow-up changes of 2026-11-17 are complete: draft-transfer links, pack sizes (called "Send in multiples of" then, "Pack Size" since 2026-11-25), a folded-up Settings page titled "ChocoTrack Settings", and typed kit sizes (1 to 48). 547 unit and render tests pass. See `sampler_builder.md`, Phase 7 and "Security review", for hosting, the review and what is deferred (custom distribution for the real store, a larger Droplet, a second dev store for the cross-shop test).

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
| I3 Report UI | Done 2026-11-13. `/app/inventory` (now the app's home page): table with locations as columns, counts, targets, incoming and draft quantities, low/over badges, search, low-only and show-without-targets filters, hide-location checkboxes (remembered per browser), "Show more" paging, banners, sidebar count in the link text. | **Done** |
| I4 Editing | Done 2026-11-13. **Edit targets** mode with min and max fields per location and per-row Save and Reset; **Add products** dialog to flag and unflag products; edit-conflict, validation and dropped-connection messages. | **Done** |
| I5 Suggestions and Settings | Done 2026-11-13. **Suggest transfers** dialog (per route and create-all, creating drafts only); **Transfer sources** card on the Settings page with ordering. | **Done** |
| I6 Hardening | Done 2026-11-13: review of the new routes, live check of Shopify query cost at full batch size, refusal to suggest when draft transfers cannot be fully read, docs. Deploy itself waits for the Droplet; the production config example already lists the new scopes. | **Done (deploy pending)** |

## As built (I2 to I6)

- **Screens:** Inventory (home), Assemble, Disassemble, Settings. The sidebar link reads "Inventory (3)" when three tracked variants are low; the count is looked up in the background and kept for a minute.
- **Reads** (`app/shopify/trackedCatalog.ts`): flagged product ids from Shopify's search, then products with variants and targets in batches of 10, then available and incoming quantities per location in batches of 25, then the app's own draft transfers, plus the saved source locations. A failure to read drafts never blocks the report: it shows a notice and hides suggestions. More than 50 open drafts from the app also hides suggestions, because some would be missed.
- **Writes** (`app/shopify/inventoryWrites.ts`, behind one endpoint `/app/api/inventory`): flag or unflag a product, save a variant's targets, save source locations, create draft transfers. Everything the browser sends is validated first (`app/lib/inventoryInput.ts`).
- **Edit conflicts:** a variant's targets are saved with the version marker they were read with. If someone else saved in between, the save is refused with "Someone else changed these targets. Reload the page..." and nothing is overwritten.
- **Creating drafts:** the server ignores any quantities from the browser and recomputes the suggestions from fresh Shopify data before creating anything. One draft per route, tagged `choco-track`, with a per-click idempotency key. Drafts are never marked ready by the app.
- **Flag lag:** Shopify's product search takes about 10 seconds to reflect a flag change. A product flagged or unflagged on screen stays that way across a refresh until the search catches up.
- **Hidden locations:** hiding a column hides it from the table only. Targets at hidden locations are kept when a row is saved, and alerts and suggestions still count every active location.
- **Not in v1 (as agreed):** email or Slack alerts, count history, marking transfers ready.

## Checks done without a person

- 462 unit and server-render tests, typecheck, lint and build clean; coverage 99% statements.
- Live tests against the dev store (`npm run test:live`, 5 tests): flag a product, save targets, prove the edit-conflict guard refuses a stale save, read the report, read a full batch within Shopify's query cost limit, plus the earlier sampler tests. Test data is cleaned up.
- The running dev server accepts the new routes (they answer with Shopify's sign-in bounce when called without a session).

**Not checked (needs a person):** clicking through the screens, creating a real draft transfer (the CLI token used for live tests has no transfer permission, so this path is covered by unit tests only), and whether the dev store grants the two new transfer scopes without a prompt.

## Human test checklist (dev store)

1. Reload the app. If Shopify asks to approve new permissions (inventory transfers), approve them. The page should open on **Inventory** and look empty ("Nothing is tracked yet").
2. **Add products**: search for "Rum Caramel" and click **Track**. The table should switch to edit mode with that product's variants showing.
3. Enter a minimum and maximum for two locations (for example min 30, max 100) and click **Save** on the row. Reload: the targets stay. Try min 50, max 10: you should get a message and nothing is saved.
4. Make a stock level fall below its minimum (adjust inventory in Shopify), click **Refresh**: the cell shows **Low**, a red banner appears at the top, and the sidebar link shows a count within about a minute.
5. On **Settings**, add a source location (for example Warehouse) under **Transfer sources** and **Save sources**.
6. Back on Inventory click **Suggest transfers**. You should see a route like Warehouse to Market Store with quantities that take the destination up to its maximum without taking the warehouse below its own minimum. Click **Create draft in Shopify**, then open Transfers in Shopify: a draft tagged `choco-track` should exist. Back in the app the cell now shows "+N in draft" and the suggestion is gone. Quantities are whole packs of each variant's group size, default 1 (a line rounded up past the maximum says so), and the modal shows an **Open draft** link per draft that opens it in Shopify (check that the link lands on the draft).
7. Open the same variant in two browser tabs, save different targets in each: the second save should be refused with the "Someone else changed these targets" message.
8. Hide a location with its checkbox: the column disappears and the targets for it are still there when you show it again.
9. Check the sampler screens still work (Assemble, Disassemble).
10. **Settings** (titled "ChocoTrack Settings"): Sampler Kits, Transfer sources and Pack Size each open and close with their triangle and start closed. **Create a new kit** is inside Sampler Kits; create a kit with a size such as 8 (typed), then edit a kit's size. Sizes 0 and 49 show a message. Make a pack size group, add variants, save, reload (it stays) and see the suggestions change. Edit a field, fold the card, reopen it: the edit is still there.

Please report anything that looks wrong; the likeliest trouble spots are the table layout in the Shopify admin (column widths and the sticky left column) and the exact wording of messages.

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

## Update: transfer links and pack sizes (built 2026-11-17, waiting for human testing)

Two changes to suggested transfers, both built test-first. 516 unit and server-render tests pass, typecheck, lint and build are clean, coverage 99%. Nothing has been clicked through in a browser.

### Change 1: link to the store's transfer page after a draft is created

- After **Create draft in Shopify** (or **Create all**), the Suggested transfers modal shows a **Draft transfers created** section: one **Open draft: Warehouse to Market Store** link per draft (new tab), plus **All transfers in Shopify**. The links stay after the suggestion drops off the list.
- The link is `https://admin.shopify.com/store/<store>/transfers/<id>`, built on the server side of the page from the session's shop domain (`app/lib/transferLinks.ts`). A bad id shows plain text with no link; an unknown store shows no links at all.
- **To verify by hand:** that this URL shape opens the draft in the admin. If it does not, the fix is one line in `transferLinks.ts` (the list link is the fallback).

### Change 2: ship in pack sizes ("Pack Size")

**Rule (confirmed 2026-11-17):** a transfer quantity is a whole multiple of the variant's pack size, the highest that does not go over the maximum. **No location is left below its minimum:** if rounding down would leave the destination below its minimum, the quantity rounds **up** to the smallest multiple that reaches it, even past the maximum, and the line says "rounded up to a full box so <location> stays at its minimum". Each source gives whole multiples only (its spare stock above its own minimum is rounded down). If the sources cannot supply enough whole multiples to reach the minimum, the destination shows as a still-low shortfall; the app never ships a partial pack.

**Setting (changed 2026-11-25):** Settings page, **Pack Size** card. A **default pack size** (built in: 1) and any number of **groups**. Each group has its own pack size (whole numbers 1 to 1,000) and a list of the variants that ship in it, added with **Add products** (search by name, SKU or barcode, optionally within a collection, with an **Add all N shown** button for things like the minis). A variant is in at most one group (adding it to another moves it); a variant in no group uses the default. Nothing is matched by name. Stored with the app installation (`$app:inventory` / `pack_sizes`, as variant ids), no database; until someone saves, everything ships one at a time. The earlier by-name setting (`multiples`) is no longer read.

**Where it applies:** `app/domain/packSizes.ts` (parse, validate, look up by variant id, move variants between groups), `app/domain/suggest.ts` (the rounding), `planTransfers` (shared by the screen preview and the server, which recomputes on fresh data before creating anything, so the draft always matches the preview).

### Test additions

Human test checklist step 6 changes: quantities are whole packs of each variant's group size (default 1), a line that was rounded up says so, and after creating a draft the **Open draft** link opens it in Shopify. New steps: on **Settings**, make a pack size group (for example 100), add the minis to it with **Add products**, save, reload (the group and the variant names stay) and see the suggestions change; try 0 or 2.5 (a message, nothing saved), and add a variant that is already in another group (it moves).

### Settings page layout

Every section on Settings is folded behind a disclosure triangle and starts closed: **Sampler Kits** (all kits together, one triangle), **Transfer sources** and **Pack Size**. Kit size is now a typed number (1 to 48) on each kit and in Create kit (`CollapsibleSection`, built on the browser's details/summary because Polaris has no accordion). Contents stay loaded while folded, so unsaved edits survive. Checklist: open and close each card; edit a field, fold the card, reopen it and the edit is still there.

### Risks

- The admin URL shape for a transfer (verify once).
- A variant whose name is not "Mini" but is sold in boxes of 100 needs its own override (the card adds them by name).
- Rounding up can put a destination above its maximum; this is deliberate and flagged on the line.
- Overrides match the variant name only, so renaming a variant in Shopify silently moves it back to the default.

## Later

Email or Slack alerts from a scheduled job, a history of counts and trends, auto-marking transfers ready, reorder suggestions for supplier purchase orders.
