# Plan: inventory alert onboarding, and no alerts until setup is done

Written 2026-11-27 from early store-team feedback. **Status (2026-11-27): built on branch `feat/inventory-setup-guide`, tested in the browser against the dev store, waiting for the PR review and human testing.** See "As built" and "Human test checklist" at the end. Fits into `inventory_tracker.md` (the Inventory section) and uses the same process as the rest of the app: tests first, then code, then review, one PR, deployed by the owner.

## The two requirements

1. **Onboarding on the homepage.** The homepage is Inventory (`/` and `/app` redirect to `/app/inventory`). A new install shows a guided setup there that walks the person through everything the alerts depend on.
2. **No alerts until setup is complete.** Until the person finishes the guide, nothing that warns about low stock appears anywhere in the app.

## Why this is needed (what happens today)

A new install starts with nothing flagged, no targets, no source locations and no pack sizes. The page says "Nothing is tracked yet". Alerts depend on three separate things the person has to discover alone: flagging products (**Add products**), then **Edit targets** per variant and location, then (for transfers) **Transfer sources** and **Pack Size** on the Settings page. A half-done setup produces misleading alerts: a product flagged with one target shows a red banner and a sidebar count while the rest of the catalog is unwatched.

## What counts as "alerting" (what gets switched off)

All of these are driven by one rule, "setup is complete". Today they are computed in these places:

| Alert surface | Where it lives today | While setup is incomplete |
|---|---|---|
| Sidebar count, `Inventory (3)` | `app/routes/app.tsx` via `useLowCount` and `app/routes/app.api.inventory-low.tsx` | Plain `Inventory`. The endpoint answers `count: 0` **without reading the report** |
| Red "N items are below their minimum" banner and **Show only low** | `InventoryView.tsx` (`lowSummary`) | Hidden |
| Low / over badges and colors in cells | `ReportCell.tsx` | Cells show the count and target in a neutral tone |
| **Suggest transfers** button and count | `InventoryView.tsx`, `SuggestedTransfersModal.tsx` | Hidden (suggestions are generated from low cells) |
| "N tracked products have no targets yet" banner | `InventoryView.tsx` (`productsWithoutTargets`) | Replaced by the matching setup step, so it is not a second nag |

## Design

### What "setup complete" means

Setup is complete when **both** are true:
- **A.** Required steps are satisfied by data: at least one flagged product, and at least one monitored variant (it has targets and is not switched off).
- **B.** The person pressed **Turn on alerts** (step 4).

Condition B is explicit on purpose: reaching one target is not "done", and the person should choose the moment alerts start. Condition A keeps the button disabled until there is something to alert on.

### The guide (a setup guide card on the Inventory homepage)

Built to Shopify's [App home and onboarding](https://shopify.dev/docs/apps/design/user-experience/app-home-page) guidance, the [Setup guide](https://shopify.dev/docs/api/app-home/patterns/compositions/setup-guide) composition and the [Homepage](https://shopify.dev/docs/api/app-home/patterns/templates/homepage) template. **Four steps**, because Shopify says to avoid more than five ("additional steps can lead to merchant drop off").

| Step | Required | Done when | Action button (primary) |
|---|---|---|---|
| 1. Choose the products to watch | Yes | one or more products flagged (data) | **Add products** (`AddProductsModal`) |
| 2. Set a minimum and maximum | Yes | one or more monitored variants (data) | **Set targets** (opens the table's Edit targets mode) |
| 3. Set up transfers | No | sources saved, or the person pressed **Skip** (stored) | **Open transfer settings** (link to Settings: Transfer sources and Pack Size) |
| 4. Turn on alerts | Yes | the completion flag (stored) | **Turn on alerts**, disabled until steps 1 and 2 are done |

Steps 1 and 2 are marked complete **automatically from Shopify data**, as Shopify's guide recommends, so closing the app and coming back resumes where the person left off. Step 3 shows a tertiary **Skip** beside its primary button; step 4 is done by pressing its button. Step 4's details preview what will start ("12 variants are watched; 3 are low right now"), so the first banner is not a surprise.

**How it follows the Shopify guide**

| Shopify rule | In this plan |
|---|---|
| Use the Setup guide composition: a section card, steps in the section separated by dividers, a checkbox per step, details beneath the row, no box per row | One `s-section` (`heading="Setup guide"`), steps as rows with `s-divider`, details open in line under the step label |
| Progress indicator, steps marked complete automatically | `supplemental` slot text "N of 4 steps completed", recomputed from data. Checkboxes show state only (not clickable); a short **Toast** ("Step 1 done") when a step flips to complete |
| Step: title, body text, one button that completes the step | Each step has a title, one or two plain sentences, a **primary** button, and at most one **tertiary** button (neutral tone) |
| Brief and direct; ask only for required information | One sentence per step; only products and one min/max are required; transfers are skippable |
| Complex onboarding: let merchants finish later (e.g. "Remind me later") | The guide has a chevron to collapse it (accessibility label "Toggle setup guide"), and each step collapses too. The rest of Inventory stays usable, and progress is kept, so finishing later needs no separate button |
| Dismiss with the X icon only if onboarding is not essential | **No X while alerts are off**, because the guide is how alerts get turned on. Once alerts are on, the guide shows 4 of 4 and gets the X (`accessibilityLabel="Dismiss guide"`, in `secondary-actions`). The dismissal is stored in the setup state, not browser storage, so it follows the store, not one browser |
| Use banners sparingly; one banner visible at a time | While setup is incomplete, none of the alert banners show (they are gated). The existing banners for a failed draft read or truncated variants are out of scope here but must not stack with the guide; check in S4 |
| Homepage: cards are sections, name with `heading`, status in `supplemental`, actions in `secondary-actions`, icon buttons carry an `accessibilityLabel` | Followed for the guide card, with the labels above |
| Homepage: surface status that is immediately actionable, with clear call-to-action buttons | Once alerts are on, the homepage keeps its existing status (low banner, counts) and page actions (**Add products**, **Suggest transfers**) |
| Support CTA placed consistently, out of the way | Not part of this plan |

While the guide is open the table stays usable (step 2 needs it), but with the alert surfaces above switched off. The guide sits directly under the page header, above the table.

### Where the setup state is stored

One JSON metafield on the app installation, beside the existing ones: `$app:inventory` / `setup`, e.g. `{ "completed": true, "transfersSkipped": false, "guideDismissed": false }`. No database, same pattern as `sources` and `pack_sizes`. It is read in the **same query** as those two (`SOURCES_QUERY` in `trackedCatalog.ts`), so there is no extra request.

Three states: **absent** (never set), `completed: true`, `completed: false` (restarted).

### Existing installs (the dev store, and any other already in use)

An install with no stored state **and** at least one monitored variant is already in use, so it is set up (nothing changes for the dev store: 29 products flagged with targets). An install with no stored state and nothing monitored is new, so it gets the guide.

**This is decided once and written down** (`ensureSetupState`, run by the Inventory loader, the sidebar lookup and the setup action). The first plan inferred it live on every read, and review found the flaw: on a new install, setting the first target would make the store look like an old one and switch alerts on, and hide the guide, before **Turn on alerts**. Now a new store is saved as `completed: false` at its first look and an old one as complete with the guide closed; nothing is inferred after that. **Restart setup guide** (Settings) writes `completed: false` again, and is also how the guide is tested on the dev store.

### The gate is one pure function

`app/domain/setup.ts`, no Shopify imports, tested first:
- `setupSteps(report)` returns the four steps with `done` flags, the progress count and the next unfinished step.
- `resolveSetup(stored, report)` returns `{ complete, canFinish, steps }`, including the existing-install rule.
- `alertsEnabled(resolved)` is the single answer every alert surface asks. No surface re-derives it.

### Server

- `loadTransferSettings` also returns the stored setup state (same query).
- New write `saveSetupState(client, { completed })` in `inventoryWrites.ts`, and new intents `completeSetup` and `restartSetup` in `inventoryInput.ts` / `handleInventory.ts`. The server **re-checks condition A on fresh data** before accepting `completeSetup` (the browser is never trusted), and rejects with a plain message otherwise.
- `app.api.inventory-low.tsx` reads the stored state first. If it is `completed: false`, it returns `count: 0` and skips the full report read. If it is absent, it loads the report and applies `resolveSetup` (legacy rule). After `completeSetup` or `restartSetup` it calls `forgetLowCount(shop)` so the sidebar updates at once.
- No new scopes.

## Phases (TDD, 80%+ coverage, one PR from one branch, one commit per phase)

| Phase | Work | Done when |
|---|---|---|
| S1 Domain | `setup.ts` with tests first: steps, `canFinish`, legacy rule, `alertsEnabled`. Table-driven cases: empty install, flagged only, flagged with all variants untracked, targets set, restarted, legacy | all green, no Shopify imports |
| S2 Shopify + server | Read and write the setup metafield; `completeSetup` / `restartSetup` intents with input validation and the fresh-data check; low-count endpoint short-circuit and cache reset. Unit tests with the fake client | tests green; a live test round-trips the metafield and cleans up |
| S3 Gate the alerts | Pass `alertsEnabled` into `InventoryView`, `ReportCell`, the banner and Suggest transfers; the sidebar hook gets plain text when count is 0. Render tests for each surface in both states | every row of the surface table has a render test |
| S4 Guide UI | `SetupGuide` section and its four steps in the Shopify setup-guide structure (see the table above), wired to the existing modal and Settings; **Skip** for step 3; collapse toggles; X only after alerts are on; **Turn on alerts** disabled until condition A. Render tests assert the structure (heading, progress text, dividers, accessibility labels, no X while incomplete) and that no two banners show together; copy kept to one or two plain sentences per step | a new install reaches "alerts on" using only the guide |
| S5 Restart control | **Restart setup guide** on Settings, with a confirm line ("alerts will pause until you finish again") | button round-trips the state |
| S6 Browser tests | Extend `e2e/`: restart the guide on the dev store, confirm no banner / count / low badges, walk the steps, confirm alerts appear after **Turn on alerts**, then leave the store as found. The existing 22 tests assume alerts are on, so the suite first makes sure setup is complete | suite green against the deployed app, still failing on browser JS errors |
| S7 Review and docs | code-review and security-review (a new write endpoint and a gate that must not be bypassable from the browser); update `inventory_tracker.md`, `sampler_builder.md` status and the README | PR open for the owner |

Release follows the usual route: I open the PR; the owner reviews, merges and approves the deploy; then I run the browser tests against the deployed app.

## Risks and decisions

- **Hiding alerts can hide real problems.** A store that never finishes the guide never gets warned. Mitigation: the guide is the first thing on the homepage, and the sidebar link can read `Inventory (setup)`. Open question 3.
- **The legacy rule is a guess about intent.** An install with targets but no stored state is called complete. Wrong only for an install that deliberately wants the guide; **Restart** covers that.
- **Gate must be one place.** If a future alert surface forgets `alertsEnabled`, it leaks. A render test per surface, and a note in the domain file, keep this honest.
- **Step 2 is the heavy one.** Setting min and max for every variant is the long part of onboarding. The guide only requires one; it should say clearly that more can be added any time. Bulk entry (copy a target to many variants) is a later idea, not in this plan.
- **Draft transfers and the live store.** Nothing here touches Shopify transfers; step 3 only links to the existing Settings cards.

## Decisions (owner, 2026-11-27)

1. **Required steps:** a flagged product plus one variant with targets. Transfer sources are optional.
2. **Table:** hidden until step 1 is done (a product is flagged). After that it shows, with alerts off, so targets can be set in it.
3. **Sidebar:** reads `Inventory (setup)` while setup is unfinished.
4. **Pausing alerts later:** the Settings button "Pause alerts and restart setup" (default taken from the recommendation).

## As built

- **Domain** `app/domain/setup.ts` (34 tests): state, `resolveSetup`, `applySetupAction`, step helpers. `alertsEnabled` is the one gate.
- **Server:** `setup` intent in `handleInventory` (actions `complete`, `restart`, `skipTransfers`, `dismissGuide`), validated by `parseSetupInput`; Turn on alerts is re-checked on fresh Shopify data; `restart` reads nothing; the others read only the saved state unless it is missing or the action is `complete`. `saveSetup` writes `$app:inventory/setup`. `ensureSetupState` decides a store with no saved state once.
- **Sidebar:** `/app/api/inventory-low` returns `{count, setupNeeded}`, skips the report read while setup is unfinished, and the in-memory cache ignores an answer that began before a change. The sidebar refreshes at once when alerts are turned on or paused (`alertsChanged`), not only on the next page.
- **Screens:** `SetupGuide` (Shopify setup guide structure), `SetupGuideCard` on Settings, and `InventoryView` gating the banner, sidebar, badges and marks, Low only filter, Suggest transfers (button and dialog), source and targets nudges, and the truncated and drafts banners. `alerts` is a required prop on the cell, row and table so a new caller cannot forget it.
- **Tests:** 846 unit and render tests, 99% lines. 24 browser tests (2 new) against the dev app, all passing: restart, no alert anywhere, finish the guide, alerts return and the sidebar updates, close the guide and it stays closed; and the server refusing an unknown action. The run leaves the dev store with alerts on and the guide closed.
- **Reviews:** a code review and a security review ran on the diff. Both found the live legacy inference (fixed, see above). Also fixed: a slow older page load undoing a button press, the cache race, the sidebar showing an old number after a failed refresh, the setup action reading the whole report each time, a disabled Set targets with no explanation. Not done on purpose: de-duplicating overlapping sidebar requests and sharing the cache between server instances (one instance runs today; same as the other endpoints), and a digest check on the setup write (two tabs pressing different buttons in the same instant could drop one flag).

## Not covered by the browser tests

The dev store already has products and targets, so a **brand-new install** (empty report, table hidden, first product flagged from the guide) is covered by unit and render tests but not clicked through in a real browser. Check it on a fresh install: the live store.

## Human test checklist

On the dev store (open the app as usual; setup is already complete there):
1. **Settings > Setup guide**: press **Pause alerts and restart setup**, confirm **Pause alerts now**. A banner says setup restarted.
2. Open **Inventory**. The **Setup guide** card is on top with "N of 4 steps completed". The sidebar says `Inventory (setup)`. There is no red banner, no Low or Over max badges, no **Low only** filter and no **Suggest transfers** button. Counts and targets still show. There is no X on the guide.
3. Open and close each step with its chevron, and collapse the whole guide. On the transfers step, **Skip** ticks it; **Open transfer settings** goes to Settings.
4. On the last step, the text says how many variants are watched and how many are low. Press **Turn on alerts**. Within a moment: the red banner and badges are back, **Suggest transfers** is back, the sidebar reads `Inventory (N)`, and the guide shows 4 of 4 with an X.
5. Press the **X**: the guide goes, and stays gone after a reload.
6. Look at the guide in a narrow browser window and in dark mode if the admin is set that way.

On a fresh install (the live store, later):
7. Opening Inventory shows only the guide (no table). **Add products** flags a product and the table appears with its variants in edit mode; set one minimum and maximum, save the row. The guide ticks steps 1 and 2 with a toast, and alerts stay **off** until **Turn on alerts** is pressed. Nothing should turn alerts on by itself, even after more targets are saved.
