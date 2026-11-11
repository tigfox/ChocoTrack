// Opt-in check against a real dev store: `LIVE_STORE=<store>.myshopify.com npm run test:live`.
// Reads the catalog, then assembles and disassembles one kit (net stock change: zero).
import { execFileSync } from 'node:child_process';
import { listCollections, listKits, searchVariants } from './catalog';
import { createKit } from './kits';
import type { GraphqlClient } from './client';
import { ShopifyApiError } from './errors';
import { loadStock } from './inventory';
import type { StockMap } from '../domain/types';
import { listLocations } from './locations';
import { handleRun } from '../lib/handleRun';

const store = process.env.LIVE_STORE;

const cliClient: GraphqlClient = async <T>(query: string, variables?: Readonly<Record<string, unknown>>) => {
  const args = ['store', 'execute', '--store', store as string, '--json', '--allow-mutations', '--query', query];
  if (variables) args.push('--variables', JSON.stringify(variables));
  const out = execFileSync('shopify', args, { encoding: 'utf8', env: { ...process.env, OPT_OUT_INSTRUMENTATION: 'true' } });
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
    expect(locations.map((l) => l.name)).toEqual(expect.arrayContaining(['Warehouse', 'Market Store']));
    expect(collections.map((c) => c.title)).toContain('Mini bars (not sold individually)');
    expect(kitList.map((k) => [k.sku, k.kitSize])).toEqual(expect.arrayContaining([['SMP-12', 12], ['SMP-4', 4], ['SMP-5', 5], ['SMP-6', 6]]));
    expect(minis.variants.map((m) => m.sku)).toContain('MINI-RUM-CARAMEL');
    // Product images come through for the box preview and the pick list (seed with scripts/upload-dev-images.mjs).
    expect(minis.variants.every((m) => m.imageUrl?.startsWith('https://cdn.shopify.com/'))).toBe(true);
  }, 60_000);

  it('assembles then disassembles one 4-pack, restoring stock', async () => {
    const [locations, kits, minis] = await Promise.all([
      listLocations(cliClient),
      listKits(cliClient),
      searchVariants(cliClient, { text: 'MINI-', first: 4 }),
    ]);
    const kitList = kits.variants;
    const warehouse = locations.find((l) => l.name === 'Warehouse');
    const kit = kitList.find((k) => k.sku === 'SMP-4');
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
    const [locations, minis] = await Promise.all([listLocations(cliClient), searchVariants(cliClient, { text: 'MINI-', first: 4 })]);
    const warehouse = locations.find((l) => l.name === 'Warehouse');
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
});
