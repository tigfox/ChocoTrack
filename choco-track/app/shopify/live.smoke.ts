// Opt-in check against a real dev store: `LIVE_STORE=<store>.myshopify.com npm run test:live`.
// Reads the catalog, then assembles and disassembles one kit (net stock change: zero).
import { execFileSync } from 'node:child_process';
import { listCollections, listKits, searchVariants } from './catalog';
import { createKit } from './kits';
import { findFlaggedProductIds, loadInventoryReport, loadLevels, loadProducts, loadTransferSettings } from './trackedCatalog';
import { saveVariantTargets, searchProductsForFlag, setProductFlag } from './inventoryWrites';
import type { GraphqlClient } from './client';
import { ShopifyApiError } from './errors';
import { loadStock } from './inventory';
import type { StockMap } from '../domain/types';
import { listLocations } from './locations';
import { handleRun } from '../lib/handleRun';
import { handleInventory } from '../lib/handleInventory';
import { loadVariantLabels } from './variantLabels';

const store = process.env.LIVE_STORE;

const cliClient: GraphqlClient = async <T>(query: string, variables?: Readonly<Record<string, unknown>>) => {
  const args = ['store', 'execute', '--store', store as string, '--json', '--allow-mutations', '--query', query];
  if (variables) args.push('--variables', JSON.stringify(variables));
  let out: string;
  try {
    out = execFileSync('shopify', args, { encoding: 'utf8', env: { ...process.env, OPT_OUT_INSTRUMENTATION: 'true' } });
  } catch (err) {
    // The CLI exits non-zero on GraphQL errors such as "access denied"; surface its message like the Admin API client does.
    const stdout = String((err as { stdout?: unknown }).stdout ?? '');
    throw new ShopifyApiError(stdout.includes('"message"') ? stdout : String(err));
  }
  const body = JSON.parse(out.slice(out.indexOf('{\n')));
  if (body.errors) throw new ShopifyApiError(JSON.stringify(body.errors));
  return body.data as T;
};

describe.skipIf(!store)('live dev store', () => {
  it('reads locations, collections, kits and minis', async () => {
    const [locations, collections, kits, minis] = await Promise.all([
      listLocations(cliClient),
      listCollections(cliClient),
      listKits(cliClient),
      searchVariants(cliClient, { text: 'caramel' }),
    ]);
    const kitList = kits.variants;
    expect(locations.map((l) => l.name)).toEqual(expect.arrayContaining(['Warehouse', 'Factory', 'Market Store', 'Cafe']));
    expect(collections.map((c) => c.title)).toEqual(expect.arrayContaining(['Mini bars', 'Limited Editions', 'Dark Milks', 'Rare', 'Single Origin', 'Dark', 'Milk']));
    // Kits are marked by the importer (--kits): the 12-bar sampler box and the 6-bar single-origin box.
    expect(kitList.map((k) => [k.sku, k.kitSize])).toEqual(expect.arrayContaining([['BAR-SAM-DML', 12]]));
    expect(kitList.map((k) => k.kitSize)).toContain(6);
    // A mini flavor is a variant of its category product, shown by its display name with the category under it.
    const rum = minis.variants.find((m) => m.sku === 'MIN-RCL-DMK');
    expect(rum).toMatchObject({ title: 'Rum Caramel', group: 'Dark Milks' });
    const peach = (await searchVariants(cliClient, { text: 'MIN-PCH-DMK' })).variants[0];
    expect(peach?.title).toBe('Peach IPA');
    // Product images come through for the box preview and the pick list.
    expect(rum?.imageUrl?.startsWith('https://cdn.shopify.com/')).toBe(true);
  }, 60_000);

  it('assembles then disassembles one 12-bar sampler box, restoring stock', async () => {
    const [locations, kits, minis] = await Promise.all([
      listLocations(cliClient),
      listKits(cliClient),
      searchVariants(cliClient, { text: 'MIN-', first: 12 }),
    ]);
    const kitList = kits.variants;
    // The minis are stocked at the Factory (the importer puts 1500 of each there).
    const warehouse = locations.find((l) => l.name === 'Factory');
    const kit = kitList.find((k) => k.sku === 'BAR-SAM-DML');
    if (!warehouse || !kit) throw new Error('seed data missing');
    const perKit = Object.fromEntries(minis.variants.map((m) => [m.id, 1]));
    const ids = [kit, ...minis.variants].map((v) => v.id);
    const run = (mode: 'assemble' | 'disassemble', seenStock: StockMap) =>
      handleRun(
        cliClient,
        { mode, kitId: kit.id, kitCount: 1, locationId: warehouse.id, perKit, seenStock, runId: crypto.randomUUID() },
        mode,
      );

    const before = await loadStock(cliClient, ids);
    const assembled = await run('assemble', before);
    expect(assembled.result).toMatchObject({ ok: true });

    const mid = await loadStock(cliClient, ids);
    expect(mid[kit.id]?.[warehouse.id]).toBe((before[kit.id]?.[warehouse.id] ?? 0) + 1);

    // A second submit with the old snapshot must be refused as stale, changing nothing.
    const stale = await run('assemble', before);
    expect(stale.result).toMatchObject({ ok: false, kind: 'conflict' });
    expect(await loadStock(cliClient, ids)).toEqual(mid);

    const disassembled = await run('disassemble', mid);
    expect(disassembled.result).toMatchObject({ ok: true });
    expect(await loadStock(cliClient, ids)).toEqual(before);
  }, 180_000);

  // Regression: a brand-new kit has no inventory level at the chosen location, so assembling must activate it
  // (API 2026-07 requires an idempotency key on inventoryActivate).
  it('assembles and disassembles a brand-new kit, then deletes it', async () => {
    const [locations, minis] = await Promise.all([listLocations(cliClient), searchVariants(cliClient, { text: 'MIN-', first: 4 })]);
    const warehouse = locations.find((l) => l.name === 'Factory');
    if (!warehouse) throw new Error('seed data missing');
    const sku = `LIVE-TEST-${Date.now()}`;
    const kit = await createKit(cliClient, { title: `Live test ${sku}`, size: 4, sku });
    const productId = await cliClient<{ productVariant: { product: { id: string } } }>(
      'query($id: ID!) { productVariant(id: $id) { product { id } } }',
      { id: kit.id },
    ).then((d) => d.productVariant.product.id);
    try {
      const perKit = Object.fromEntries(minis.variants.map((m) => [m.id, 1]));
      const ids = [kit.id, ...minis.variants.map((m) => m.id)];
      const before = await loadStock(cliClient, ids);
      const run = (mode: 'assemble' | 'disassemble', seenStock: StockMap) =>
        handleRun(
          cliClient,
          { mode, kitId: kit.id, kitCount: 1, locationId: warehouse.id, perKit, seenStock, runId: crypto.randomUUID() },
          mode,
        );
      expect((await run('assemble', Object.fromEntries(ids.map((id) => [id, before[id] ?? {}])))).result).toMatchObject({ ok: true });
      const mid = await loadStock(cliClient, ids);
      expect(mid[kit.id]?.[warehouse.id]).toBe(1);
      expect((await run('disassemble', mid)).result).toMatchObject({ ok: true });
      const after = await loadStock(cliClient, ids);
      expect(after[kit.id]?.[warehouse.id]).toBe(0);
      expect(minis.variants.map((m) => after[m.id]?.[warehouse.id])).toEqual(minis.variants.map((m) => before[m.id]?.[warehouse.id]));
    } finally {
      await cliClient('mutation($input: ProductDeleteInput!) { productDelete(input: $input) { deletedProductId userErrors { message } } }', {
        input: { id: productId },
      });
    }
  }, 240_000);

  // Inventory tracking: flag a product, save and guard targets, read the report. Draft transfers are not covered
  // here because the CLI token has no transfer scope; they are exercised through the running app.
  it('flags a product, saves targets with the edit-conflict guard, and reads the report', async () => {
    const candidates = await searchProductsForFlag(cliClient, { text: 'Rum Caramel' });
    const candidate = candidates.find((c) => c.title.includes('Rum Caramel'));
    if (!candidate) throw new Error('seed data missing');
    const wasTracked = candidate.tracked;
    const [location] = await listLocations(cliClient);
    if (!location) throw new Error('no location');
    await setProductFlag(cliClient, candidate.id, true);
    try {
      const [product] = await loadProducts(cliClient, [candidate.id]);
      const variant = product?.variants[0];
      if (!variant) throw new Error('no variant');
      const original = variant.targets;
      const first = await saveVariantTargets(cliClient, { variantId: variant.id, targets: { [location.id]: { min: 3, max: 9 } }, digest: variant.digest });
      expect(first.digest).toEqual(expect.any(String));
      // Editing from an out-of-date digest must be refused, not silently overwrite.
      await expect(
        saveVariantTargets(cliClient, { variantId: variant.id, targets: { [location.id]: { min: 1, max: 2 } }, digest: variant.digest ?? 'stale' }),
      ).rejects.toMatchObject({ isStaleObject: true });
      const second = await saveVariantTargets(cliClient, { variantId: variant.id, targets: { [location.id]: { min: 4, max: 12 } }, digest: first.digest });
      const [reloaded] = await loadProducts(cliClient, [candidate.id]);
      expect(reloaded?.variants[0]?.targets).toEqual({ [location.id]: { min: 4, max: 12 } });
      expect(reloaded?.variants[0]?.digest).toBe(second.digest);
      const levels = await loadLevels(cliClient, [variant.id]);
      expect(Object.values(levels[variant.id] ?? {})[0]).toMatchObject({ available: expect.any(Number), incoming: expect.any(Number) });
      // Shopify's search index lags a few seconds behind a new flag.
      const deadline = Date.now() + 90_000;
      let ids: readonly string[] = [];
      while (Date.now() < deadline && !ids.includes(candidate.id)) {
        ids = await findFlaggedProductIds(cliClient);
        if (!ids.includes(candidate.id)) await new Promise((r) => setTimeout(r, 5_000));
      }
      expect(ids).toContain(candidate.id);
      const report = await loadInventoryReport(cliClient);
      expect(report.products.map((p) => p.id)).toContain(candidate.id);
      // Without the transfer scope the report still loads and says why suggestions are hidden.
      expect(report.draftsError === undefined || /permission/i.test(report.draftsError)).toBe(true);
      await saveVariantTargets(cliClient, { variantId: variant.id, targets: original, digest: second.digest });
    } finally {
      await setProductFlag(cliClient, candidate.id, wasTracked);
    }
  }, 240_000);

  // Pack sizes: save a group holding a mini, read it back as Settings does (ids and names), then restore the default.
  it('saves a pack size group, reads it back with names, and restores the default', async () => {
    const mini = (await searchVariants(cliClient, { text: 'MIN-BOL-RAR' })).variants[0];
    if (!mini) throw new Error('seed data missing');
    const before = (await loadTransferSettings(cliClient)).packSizes;
    try {
      const saved = await handleInventory(cliClient, { intent: 'savePackSizes', defaultSize: 1, groups: [{ size: 100, variantIds: [mini.id] }] });
      expect(saved).toMatchObject({ ok: true });
      const { packSizes } = await loadTransferSettings(cliClient);
      expect(packSizes).toEqual({ defaultSize: 1, groups: [{ size: 100, variantIds: [mini.id] }] });
      const labels = await loadVariantLabels(cliClient, [mini.id]);
      expect(labels[mini.id]).toMatchObject({ title: 'Bolivia 72%', sku: 'MIN-BOL-RAR', group: 'Rare' });
    } finally {
      await handleInventory(cliClient, { intent: 'savePackSizes', defaultSize: before.defaultSize, groups: before.groups });
    }
    expect((await loadTransferSettings(cliClient)).packSizes).toEqual(before);
  }, 120_000);

  // The Untracked switch: set it on a variant, read it back as the report does, then restore it.
  it('switches a variant off for the report and back on', async () => {
    const mini = (await searchVariants(cliClient, { text: 'MIN-HAI-ORI' })).variants[0];
    if (!mini) throw new Error('seed data missing');
    const { productVariant } = await cliClient<{ productVariant: { product: { id: string } } }>('query($id: ID!) { productVariant(id: $id) { product { id } } }', { id: mini.id });
    const read = async () => (await loadProducts(cliClient, [productVariant.product.id]))[0]?.variants.find((v) => v.id === mini.id);
    try {
      expect(await handleInventory(cliClient, { intent: 'setVariantUntracked', variantId: mini.id, untracked: true })).toMatchObject({ ok: true });
      expect((await read())?.untracked).toBe(true);
    } finally {
      await handleInventory(cliClient, { intent: 'setVariantUntracked', variantId: mini.id, untracked: false });
    }
    expect(await read()).not.toHaveProperty('untracked');
  }, 120_000);

  // Shopify rejects queries over a cost limit; this reads a full batch (10 products, 25 variants) to prove it fits.
  it('reads a full batch of products and variants within Shopify\'s query cost limit', async () => {
    const { products } = await cliClient<{ products: { nodes: ReadonlyArray<{ id: string }> } }>(
      '{ products(first: 10, query: "title:Mini*") { nodes { id } } }',
    );
    expect(products.nodes).toHaveLength(10);
    const loaded = await loadProducts(cliClient, products.nodes.map((p) => p.id));
    expect(loaded).toHaveLength(10);
    const variantIds = loaded.flatMap((p) => p.variants.map((v) => v.id)).slice(0, 25);
    expect(variantIds.length).toBeGreaterThan(5);
    const levels = await loadLevels(cliClient, variantIds);
    expect(Object.keys(levels).length).toBe(variantIds.length);
  }, 120_000);
});
