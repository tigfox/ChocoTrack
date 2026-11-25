# Refactor plan: ChocoTrack on the River Sea product structure

Written 2026-11-24, after the dev store `creeklakeconfections` was rebuilt from the live store's exports (branch `feat/river-sea-dev-import`).

## What changed in the data

| Before (seed data) | Now (River Sea export) |
|---|---|
| One product per mini bar (`Mini - Bolivia 72%`, SKU `MINI-…`) | One product per **category** (`Mini Bars - Rare`), one **variant per flavor** (`bolivia-72`, SKU `MIN-BOL-RAR`) |
| Kits are products the app creates, tagged `choco-track-kit`, size in a **product** metafield | Kits are existing products: `12 Bar Mini Sampler Box`, `6 Bar Mini Single-Origin Select Box`, `5 Bar Mini Pack`, … Some have several variants (`Mini Bars (Assorted)`: 4 Minis Mix / Milk / Dark / Single-Origin) |
| Collections `Mini bars (not sold individually)`, `Dark chocolate`, `Milk chocolate` hold the products | Those collections still exist but are **empty** (products were replaced). The export has no collection data |
| Variant `barcode` | Variants carry `barcodes` (a list); some hold `gtin:…; SKU` |
| 1 SKU per product | 25 new `MIN-…` SKUs; 43 variants in all have SKUs |

## What already works (no change needed)

- The whole `app/domain/` layer (validation, pick list, box image, targets) works on **variants**, so minis as variants are fine.
- `toCatalogVariant` already names variants `"<Product> - <Variant>"`.
- Atomic `inventoryAdjustQuantities` for assemble/disassemble works per inventory item.
- The Inventory report flags **products** and sets targets per **variant**; it needs data (flags and targets), not code.

## What breaks, and the fix

| # | Problem | Where | Fix |
|---|---|---|---|
| 1 | **Kit size and category live on the product.** `Mini Bars (Assorted)` has four variants of different sizes; a product-level size cannot express that | `app/shopify/catalog.ts` (`VARIANT_FIELDS`, `KITS_QUERY`), `kits.ts` (create/update) | Move `choco_track.kit_size` and `choco_track.category` to **variant** metafields. Keep the product tag `choco-track-kit` as the cheap index so `listKits` stays one query. No read fallback: no real store has kits yet |
| 2 | **No way to use an existing variant as a kit.** Settings can only *create* a new kit product | `KitSettingsView`, `CreateKitModal`, `handleKitSettings.ts` | Add "Use an existing variant as a kit": search a variant, enter size and optional category; the server sets the tag on its product and the metafields on the variant. Matches the original design ("create it or link an existing variant") |
| 3 | **Component picker starts on an empty collection.** `defaultCollectionId` picks the first collection matching `/mini/i` | `app/lib/preferences.ts` | Recreate a **Mini bars** collection holding the 7 mini category products (see open question 1 for smart vs explicit). No picker code change |
| 4 | **Kit categories have no members.** Decided: a category is **the mini product that holds the variants**, so `Limited Editions` contains Smoked Salted Caramel, Rosemary Olive Oil, Blood Orange Spice, and so on; `Dark Milks` contains Peach IPA, Desert Flower, Rum Caramel | importer | The importer creates one collection per mini product, named by category (`Limited Editions`, `Dark Milks`, `Rare`, `Single Origin`, `Dark`, `Milk`, `White Chocolate`), each holding that one product. These replace the old `Dark chocolate` / `Milk chocolate` collections |
| 5 | **Display names are long and slug-like**: `Mini Bars - Rare - bolivia-72` | `toCatalogVariant`, `FlavorPicker`, `BoxGrid`, `PickListSheet` | Add `productTitle` and `flavorName` to `CatalogVariant`. Show `flavorName` as the main label with the category as a secondary line, and group picker rows by category. Search keeps matching both. **Flavor name rule** below |
| 6 | **`barcode` vs `barcodes`.** *Spike result (2026-11-24): on the app's API version (2026-07) `ProductVariantSetInput` still takes `barcode` and has no `barcodes`; the CLI's newer default version has `barcodes`.* | `kits.ts` | **No change now.** The importer uses the newer field (it runs through the CLI). Revisit when the app's API version moves up. Variant search by exact barcode, SKU prefix and bare flavor text all work against the imported data |
| 7 | **Tests and docs name the old data** (`MINI-…`, `SMP-6`, `Mini - Bolivia 72%`, `Dark chocolate`) | `e2e/sampler.e2e.mjs`, `app/shopify/live.smoke.ts`, `e2e/README.md`, `sampler_builder.md` | Update to `MIN-…` SKUs and the real kit names; keep e2e net-zero on stock |
| 8 | **Obsolete seeding** | `scripts/seed-dev-store.mjs`, `scripts/upload-dev-images.mjs`, `scripts/seed-images/` | Delete; `import-river-sea.mjs` replaces them (images come from the export's CDN URLs) |

## Flavor name rule (decided)

For each mini variant, take its hyphenated flavor (`el-camino`). If a **non-mini product title** is a close match, use that title; otherwise humanize the flavor (`rosemary-olive-oil` becomes `Rosemary Olive Oil`).

- **Close match:** lowercase both names, drop punctuation, `%` and "and", split into words. It is a match when every word of one name appears in the other. Several matches: the shortest title wins.
- **Pure function**, tested with a table of the 25 real flavors. Overrides (a small map) cover exceptions so the rule stays simple.

Result on the live export (17 matched, 8 humanized):

| Flavor | Shown as |
|---|---|
| desert-flower, rum-caramel, double-bean-double-buzz, cherry-blossom-dark | same names, matched |
| bolivia-72, puerto-rico-72, tanzania-72, haiti-72, chuao-venezuela-72, zorzal-dominican-republic-72 | Bolivia 72%, Puerto Rico 72%, Tanzania 72%, Haiti 72%, Chuao 72%, Zorzal 72% |
| hawaiian-salt-70, el-camino | Hawaiian Salt 70%, El Camino - Olive Oil Dark Chocolate |
| organic-milk, smoked-salt-milk, salted-caramel, cherry-blossom-milk, coconut-milk | Organic Milk Chocolate, Smoked Salt Milk Chocolate, Salted Caramel Milk Chocolate, Cherry Blossom Milk Chocolate, Coconut Milk Chocolate 55% |
| smoked-salted-caramel, rosemary-olive-oil, blood-orange-spice, juniper-wildberry, milk-spiced-coffee | humanized (no product exists yet): Smoked Salted Caramel, ... |
| peach-ipa-dark-milk, peru-72, raspberry-vanilla-1 | humanized: Peach Ipa Dark Milk, Peru 72, Raspberry Vanilla 1 |

Three to review: `Peach Ipa Dark Milk` (should read `Peach IPA`), `Peru 72` (no `%`), and `Raspberry Vanilla 1` (the live bar is titled `Raspberry Vanilla Tea 65%`). These would go in the override map. The two Limited-Editions-style names that match nothing are expected.

## Kit candidates in the new store

| Product | Size | Note |
|---|---|---|
| 12 Bar Mini Sampler Box | 12 | real stock in the inventory export |
| 6 Bar Mini Single-Origin Select Box | 6 | |
| 6 Bar Mini Holiday Flavor Gift Set | 6 | |
| 5 Bar Mini Pack | 5 | |
| 4 Bar Mini Gift Bag | 4 | |
| Mini Bars (Assorted), 4 variants | 4 each | the reason kit size must be per variant |
| Mini Bars Box of 100 / 500 | n/a | bulk cartons, not assembled from mixed minis: out of scope |
| Combos (`12 Bar Mini Sampler + …`) | n/a | contain other kits, not minis: out of scope |

## Status (2026-11-25): complete and deployed

All eight steps are done and in production (PRs #19 to #28). Variant-level kit metafields; **Use an existing product as a kit**; importer collections, kits (`--kits`), flavor names and published flags (`--finish`); flavor display names with the category underneath; old seed scripts removed. Review findings (kit rename on edit, over-broad flavor humanizing, write order, link-modal state, importer `--confirm`) were fixed before merge. Follow-ups found by use and fixed: Add products list order and Show more (#20), unsaved-rows warning (#22), Pack Size groups replacing the by-name setting (#23), a crash when typing a pack size (#24), an Untracked checkbox per Inventory variant (#27).

**Checks:** 731 unit tests; live test against the dev store 7/7; browser tests 22/22 against the deployed app, now failing on browser JavaScript errors (#25).

**Left for the live store (not code):** only 2 of the 6 kit products track inventory (12 Bar Mini Sampler Box, 6 Bar Single-Origin Select Box); all 27 mini flavors are untracked; the "Mini bars" and category collections may not exist; "5 Bar Mini Pack" and "Truffles 5 Piece" share the SKU `TRU-DML-5PK`; the white chocolate minis have no SKUs. The checklist for the store team is `StoreTasks.pdf` (in `/Users/tigfox/Documents/River Sea/`). The importer refuses non-development stores, so the live store needs a separate read-only readiness check and a small job to apply the 25 display names; neither is built.

**Known limits:** the kit list reads up to 50 kit products and 10 variants each (the largest today has 6); `updateKit` and `linkKit` write in sequence (metafields first, then rename or tag), retryable but not atomic; renaming a multi-variant kit renames its product; the importer's kit and name steps read at most 50 variants per product without paging.

## Phases (TDD for every step: test first, then code, then review)

1. **Spike (done 2026-11-24).** Confirm the July26 `barcodes` input, that a variant-level metafield can be written by productSet or `metafieldsSet`, and that a smart collection with a title rule is created through the API. *Done when:* each has a working one-line GraphQL call recorded in the PR.
2. **Variant-level kit metafields** (#1). Update catalog queries, `toCatalogVariant`, `listKits`, `createKit`, `updateKit`. Unit tests for parsing a variant with and without the metafield, a kit product with mixed variants, and update validation ("only trust a variant whose product carries the tag"). *Done when:* `Mini Bars (Assorted)` lists four kits of size 4.
3. **Link an existing variant as a kit** (#2). Server handler and Settings UI, with the same validation and error paths as create. *Done when:* the store team can add `12 Bar Mini Sampler Box` as a 12-bar kit without leaving Settings.
4. **Importer: collections and kits** (#3, #4). Create `Mini bars` and the kit-category collections; optionally `--kits` to mark the known kit variants so the dev store is ready for testing. Keep it idempotent.
5. ~~Barcode API~~ (#6): not needed on 2026-07 (see spike).
6. **Display and grouping** (#5). Pure helper for the label and grouping, render tests for the picker, box grid and pick list.
7. **Retire old seeding, update tests and docs** (#7, #8). Run unit tests, typecheck, lint, the live test and `npm run test:e2e` against the dev store.
8. **Review and ship.** Code-review and security-review (new server handler that writes metafields on browser-supplied ids). PR to `main`; CI; deploy by the existing pinned-digest pipeline.

Each step is its own commit; steps 2 and 3 are the large ones.

## Risks

- **Acceptance testing is on this dev store.** The app is already deployed against it, and until steps 2–4 land the Assemble, Settings and Disassemble screens show no kits. Land 2, 3 and 4 together (one PR) and tell the store team before deploying.
- **Variant search relevance.** `productVariants(query:)` matches product and variant titles; confirm that searching a bare flavor (`bolivia`) and a scanned SKU or barcode both hit.
- **Collection rule drift.** The `Mini Bars - ` title rule depends on the live store's naming. It is a dev-store convenience; the live store may want an explicit collection.
- **Published and draft state.** The imported `Mini Bars - Limited Editions` product is a draft, so the picker may need to include drafts (it already searches variants without a status filter; verify).

## Open questions

1. ~~Mini bars collection: automatic or explicit?~~ **Decided: smart (title rule).** Original question: The Assemble screen has a "Collection" filter that narrows the component list to mini bars instead of all 116 products (wine, hoodies, and so on). It defaults to the collection whose name contains "mini". *Smart* (rule: title contains `Mini Bars - `) adds any future `Mini Bars - X` product automatically but depends on that naming. *Explicit* lists the 7 products by handle and never changes on its own. Recommendation: smart, for the dev store.
