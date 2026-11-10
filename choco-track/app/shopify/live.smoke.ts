// Opt-in check against a real dev store: `LIVE_STORE=<store>.myshopify.com npm run test:live`.
// Reads the catalog, then assembles and disassembles one kit (net stock change: zero).
import { execFileSync } from 'node:child_process';
import { listCollections, listKits, searchVariants } from './catalog';
import type { GraphqlClient } from './client';
import { ShopifyApiError } from './errors';
import { loadStock } from './inventory';
import { listLocations } from './locations';
import { submitRun } from './submit';

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
    expect(locations.map((l) => l.name)).toEqual(expect.arrayContaining(['Warehouse', 'Market Store']));
    expect(collections.map((c) => c.title)).toContain('Mini bars (not sold individually)');
    expect(kits.map((k) => [k.sku, k.kitSize]).sort()).toEqual([['SMP-12', 12], ['SMP-4', 4], ['SMP-5', 5], ['SMP-6', 6]]);
    expect(minis.map((m) => m.sku)).toContain('MINI-RUM-CARAMEL');
  }, 60_000);

  it('assembles then disassembles one 4-pack, restoring stock', async () => {
    const [locations, kits, minis] = await Promise.all([
      listLocations(cliClient),
      listKits(cliClient),
      searchVariants(cliClient, { text: 'MINI-', first: 4 }),
    ]);
    const warehouse = locations.find((l) => l.name === 'Warehouse');
    const kit = kits.find((k) => k.sku === 'SMP-4');
    if (!warehouse || !kit) throw new Error('seed data missing');
    const perKit = Object.fromEntries(minis.map((m) => [m.id, 1]));
    const variants = [kit, ...minis];
    const ids = variants.map((v) => v.id);
    const run = { kit, kitCount: 1, perKit, locationId: warehouse.id, variants };

    const before = await loadStock(cliClient, ids);
    const assembled = await submitRun(cliClient, { ...run, mode: 'assemble', stock: before });
    expect(assembled).toMatchObject({ ok: true });

    const mid = await loadStock(cliClient, ids);
    expect(mid[kit.id]?.[warehouse.id]).toBe((before[kit.id]?.[warehouse.id] ?? 0) + 1);

    const disassembled = await submitRun(cliClient, { ...run, mode: 'disassemble', stock: mid });
    expect(disassembled).toMatchObject({ ok: true });
    expect(await loadStock(cliClient, ids)).toEqual(before);

  }, 180_000);
});
