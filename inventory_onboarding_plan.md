# Plan: inventory alert onboarding, and no alerts until setup is done

Written 2026-11-27 from early store-team feedback. **Plan only; nothing is built.** Fits into `inventory_tracker.md` (the Inventory section) and uses the same process as the rest of the app: tests first, then code, then review, one PR, deployed by the owner.

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

One JSON metafield on the app installation, beside the existing ones: `$app:inventory` / `setup`, e.g. `{ "completed": true, "at": "2026-11-27T…", "transfersSkipped": false, "guideDismissed": false }`. No database, same pattern as `sources` and `pack_sizes`. It is read in the **same query** as those two (`SOURCES_QUERY` in `trackedCatalog.ts`), so there is no extra request.

Three states: **absent** (never set), `completed: true`, `completed: false` (restarted).

### Existing installs (the dev store, and any other already in use)

An install with no stored state **and** at least one monitored variant is treated as already complete, so nothing changes for the dev store (29 products flagged with targets). An install with no stored state and nothing monitored shows the guide. This is a pure function over the report, so it needs no migration or write. **Restart setup guide** (Settings) writes `completed: false`, which overrides the rule. That button is also how the guide is tested on the dev store.

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

## Open questions for the owner

1. **Required steps.** Is "one flagged product plus one variant with targets" enough to allow **Turn on alerts**, or should transfer sources also be required? (Recommendation: not required, they only affect suggestions.)
2. **While the guide is open, show the table with alerts off, or hide the table until step 2?** (Recommendation: show it, because step 2 happens in it.)
3. **A nudge in the sidebar** (`Inventory (setup)`) while incomplete? (Recommendation: yes.)
4. **Should staff be able to turn alerts off again** after finishing, as a normal setting rather than a restart for testing? (Recommendation: same button, relabelled "Pause alerts and restart setup".)
