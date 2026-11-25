import { fakeClient } from './fakeClient';
import { loadVariantLabels } from './variantLabels';

const node = (id: string, title: string, product: string, over: Record<string, unknown> = {}) => ({ id, title, sku: `S-${id}`, displayName: null, product: { title: product }, ...over });

describe('loadVariantLabels', () => {
  it('names each variant the way the pickers do, keyed by id', async () => {
    const client = fakeClient({
      nodes: [
        node('a', 'bolivia-72', 'Mini Bars - Rare', { displayName: { value: 'Bolivia 72%' } }),
        node('b', '60g Bar', 'Rum Caramel'),
        node('c', 'Default Title', 'Haiti', { sku: null }),
        node('d', 'peru-72', 'Mini Bars - Rare'),
      ],
    });
    await expect(loadVariantLabels(client, ['a', 'b', 'c', 'd'])).resolves.toEqual({
      a: { title: 'Bolivia 72%', sku: 'S-a', group: 'Rare' },
      b: { title: 'Rum Caramel - 60g Bar', sku: 'S-b' },
      c: { title: 'Haiti', sku: '' },
      d: { title: 'Peru 72', sku: 'S-d', group: 'Rare' },
    });
  });
  it('skips ids that no longer exist', async () => {
    const client = fakeClient({ nodes: [node('a', 'x', 'P'), null, {}] });
    expect(Object.keys(await loadVariantLabels(client, ['a', 'gone', 'other']))).toEqual(['a']);
  });
  it('makes no call for an empty list', async () => {
    const client = fakeClient();
    await expect(loadVariantLabels(client, [])).resolves.toEqual({});
    expect(client.calls).toHaveLength(0);
  });
  it('reads in batches of 100 ids', async () => {
    const ids = Array.from({ length: 230 }, (_, i) => `v${i}`);
    const client = fakeClient({ nodes: [] }, { nodes: [] }, { nodes: [] });
    await loadVariantLabels(client, ids);
    expect(client.calls.map((c) => (c.variables as { ids: string[] }).ids.length)).toEqual([100, 100, 30]);
  });
});
