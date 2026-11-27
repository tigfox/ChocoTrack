import { routedClient } from './routedClient';
import { resetAllSettings } from './resetSettings';

const P = (n: number) => `gid://shopify/Product/${n}`;
const V = (n: number) => `gid://shopify/ProductVariant/${n}`;
const L = 'gid://shopify/Location/1';

interface VariantSpec {
  readonly id: string;
  readonly targets?: boolean;
  readonly untracked?: 'true' | 'false';
}
const productNode = (id: string, variants: VariantSpec[], more = false) => ({
  id,
  title: `Product ${id}`,
  featuredMedia: null,
  variants: {
    nodes: variants.map((v) => ({
      id: v.id,
      title: 'Default Title',
      sku: null,
      image: null,
      inventoryItem: { id: `item-${v.id}` },
      targets: v.targets ? { value: JSON.stringify({ [L]: { min: 1, max: 2 } }), compareDigest: 'd' } : null,
      ...(v.untracked ? { untracked: { value: v.untracked } } : {}),
    })),
    pageInfo: { hasNextPage: more },
  },
});

interface Setup {
  readonly pages?: ReadonlyArray<{ ids: string[]; next?: string }>;
  readonly products: Record<string, ReturnType<typeof productNode>>;
}
const build = ({ pages = [{ ids: Object.keys({}) }], products }: Setup) => {
  const client = routedClient({
    'query AllProductIds': (v: Record<string, unknown> | undefined) => {
      const index = v?.after ? Number(String(v.after).replace('cursor-', '')) : 0;
      const page = pages[index] ?? { ids: [] };
      return {
        products: {
          nodes: page.ids.map((id) => ({ id })),
          pageInfo: { hasNextPage: page.next !== undefined, endCursor: page.next ?? null },
        },
      };
    },
    'query TrackedProducts': (v: Record<string, unknown> | undefined) => ({ nodes: ((v?.ids as string[]) ?? []).map((id) => products[id] ?? null) }),
    'mutation DeleteMetafields': { metafieldsDelete: { deletedMetafields: [], userErrors: [] } },
    'query AppInstallationId': { currentAppInstallation: { id: 'gid://shopify/AppInstallation/1' } },
    'mutation SetMetafields': { metafieldsSet: { metafields: [{ key: 'k', compareDigest: null }], userErrors: [] } },
  });
  return client;
};
const deletes = (client: ReturnType<typeof build>) =>
  client.calls.filter((c) => c.query.includes('DeleteMetafields')).flatMap((c) => c.variables?.metafields as Array<{ ownerId: string; namespace: string; key: string }>);
const sets = (client: ReturnType<typeof build>) =>
  client.calls.filter((c) => c.query.includes('SetMetafields')).flatMap((c) => c.variables?.metafields as Array<{ key: string; value: string }>);

describe('resetAllSettings', () => {
  const products = {
    [P(1)]: productNode(P(1), [{ id: V(11), targets: true }, { id: V(12) }]),
    [P(2)]: productNode(P(2), [{ id: V(21), untracked: 'true' }]),
    [P(3)]: productNode(P(3), [{ id: V(31), untracked: 'false' }]),
    [P(4)]: productNode(P(4), [{ id: V(41) }]),
  };
  const run = () => {
    const client = build({ pages: [{ ids: [P(1), P(2), P(3), P(4)] }], products });
    return { client, done: resetAllSettings(client) };
  };

  it('removes the tracked flag from every product', async () => {
    const { client, done } = run();
    await done;
    const flags = deletes(client).filter((d) => d.key === 'tracked');
    expect(flags.map((d) => d.ownerId).sort()).toEqual([P(1), P(2), P(3), P(4)]);
    expect(flags.every((d) => d.namespace === 'choco_track')).toBe(true);
  });
  it('removes targets and the untracked switch only from variants that have them', async () => {
    const { client, done } = run();
    await done;
    const found = deletes(client).filter((d) => d.key !== 'tracked').map((d) => `${d.ownerId}:${d.key}`).sort();
    expect(found).toEqual([`${V(11)}:targets`, `${V(21)}:untracked`].sort());
  });
  it('empties transfer sources and pack sizes, and sets the guide back to not complete', async () => {
    const { client, done } = run();
    await done;
    const written = Object.fromEntries(sets(client).map((s) => [s.key, JSON.parse(s.value)]));
    expect(written.sources).toEqual([]);
    expect(written.pack_sizes).toEqual({ default: 1, groups: [] });
    expect(written.setup).toEqual({ completed: false, transfersSkipped: false, guideDismissed: false });
  });
  it('turns alerts off first, so a failure part-way leaves nothing alerting', async () => {
    const { client, done } = run();
    await done;
    const order = client.calls.map((c) =>
      c.query.includes('SetMetafields') ? `set:${(c.variables?.metafields as Array<{ key: string }>)[0]?.key}` : c.query.includes('DeleteMetafields') ? 'delete' : '-',
    );
    expect(order.indexOf('set:setup')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('set:setup')).toBeLessThan(order.indexOf('delete'));
  });
  it('reports what it cleared', async () => {
    const { done } = run();
    await expect(done).resolves.toEqual({ products: 4, variants: 2, truncatedProducts: 0, moreProducts: false });
  });
  it('follows pages of products', async () => {
    const client = build({ pages: [{ ids: [P(1), P(2)], next: 'cursor-1' }, { ids: [P(3), P(4)] }], products });
    await resetAllSettings(client);
    expect(deletes(client).filter((d) => d.key === 'tracked')).toHaveLength(4);
  });
  it('deletes in batches the API accepts', async () => {
    const ids = Array.from({ length: 600 }, (_, i) => P(i + 100));
    const many = Object.fromEntries(ids.map((id, i) => [id, productNode(id, [{ id: V(i + 1000) }])]));
    const client = build({ pages: [{ ids }], products: many });
    await resetAllSettings(client);
    const sizes = client.calls.filter((c) => c.query.includes('DeleteMetafields')).map((c) => (c.variables?.metafields as unknown[]).length);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(250);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(600);
  });
  it('says so when a product has more variants than were read, and when there are more products than the cap', async () => {
    const client = build({
      pages: Array.from({ length: 9 }, (_, i) => ({ ids: i === 0 ? [P(1)] : [], next: `cursor-${i + 1}` })),
      products: { [P(1)]: productNode(P(1), [{ id: V(11), targets: true }], true) },
    });
    await expect(resetAllSettings(client)).resolves.toMatchObject({ truncatedProducts: 1, moreProducts: true });
  });
  it('does nothing to products when the store has none, but still resets the settings', async () => {
    const client = build({ pages: [{ ids: [] }], products: {} });
    await expect(resetAllSettings(client)).resolves.toEqual({ products: 0, variants: 0, truncatedProducts: 0, moreProducts: false });
    expect(client.calls.some((c) => c.query.includes('DeleteMetafields'))).toBe(false);
    expect(sets(client).map((s) => s.key).sort()).toEqual(['pack_sizes', 'setup', 'sources']);
  });
});
