import { addPending, mergeLevels, reconcileProducts, removeProduct, upsertProduct, withVariantTargets } from './reportState';
import type { ReportProduct } from '../shopify/trackedCatalog';

const variant = (id: string) => ({ id, productId: 'p', productTitle: 'P', title: 'Mini', sku: id, inventoryItemId: `i-${id}`, digest: null, targets: {} });
const product = (id: string, title: string, ...variantIds: string[]): ReportProduct => ({
  id,
  title,
  truncated: false,
  variants: variantIds.map(variant),
});

describe('withVariantTargets', () => {
  const products = Object.freeze([product('p1', 'A', 'v1', 'v2'), product('p2', 'B', 'v3')]);
  it('replaces one variant\'s targets and digest without touching the rest or the original', () => {
    const next = withVariantTargets(products, 'v2', { L: { min: 1, max: 2 } }, 'dg');
    expect(next[0]?.variants[1]).toMatchObject({ targets: { L: { min: 1, max: 2 } }, digest: 'dg' });
    expect(next[0]?.variants[0]).toBe(products[0]?.variants[0]);
    expect(next[1]).toBe(products[1]);
    expect(products[0]?.variants[1]?.targets).toEqual({});
  });
  it('is a no-op for an unknown variant', () => {
    expect(withVariantTargets(products, 'zzz', {}, null)).toEqual(products);
  });
});

describe('upsertProduct / removeProduct', () => {
  const products = [product('p1', 'Bolivia', 'a'), product('p3', 'Zorzal', 'c')];
  it('adds in title order, or replaces by id', () => {
    expect(upsertProduct(products, product('p2', 'Haiti', 'b')).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    const replaced = upsertProduct(products, product('p1', 'Bolivia 2', 'a'));
    expect(replaced.map((p) => p.title)).toEqual(['Bolivia 2', 'Zorzal']);
  });
  it('removes by id', () => {
    expect(removeProduct(products, 'p1').map((p) => p.id)).toEqual(['p3']);
    expect(removeProduct(products, 'nope')).toEqual(products);
  });
});

describe('mergeLevels', () => {
  it('overlays newer counts per variant and location', () => {
    const a = { v: { L1: { available: 1, incoming: 0 }, L2: { available: 2, incoming: 0 } } };
    const b = { v: { L1: { available: 9, incoming: 3 } }, w: { L1: { available: 5, incoming: 0 } } };
    expect(mergeLevels(a, b)).toEqual({ v: { L1: { available: 9, incoming: 3 }, L2: { available: 2, incoming: 0 } }, w: { L1: { available: 5, incoming: 0 } } });
    expect(a.v.L1.available).toBe(1);
  });
});

describe('addPending', () => {
  it('adds created draft quantities to the pending map', () => {
    const created = [
      { id: 'T1', originId: 'W', destinationId: 'M', lines: [{ variantId: 'v', quantity: 5 }, { variantId: 'x', quantity: 2 }] },
      { id: 'T2', originId: 'W', destinationId: 'C', lines: [{ variantId: 'v', quantity: 1 }] },
    ];
    expect(addPending({ v: { M: 3 } }, created)).toEqual({ v: { M: 8, C: 1 }, x: { M: 2 } });
  });
});

describe('reconcileProducts', () => {
  const server = [product('p1', 'Bolivia', 'a'), product('p2', 'Haiti', 'b')];
  it('uses the server list as is when nothing was changed locally', () => {
    expect(reconcileProducts(server, [], {})).toEqual(server);
  });
  it('keeps a product flagged on a moment ago even though the search index has not caught up', () => {
    const local = product('p9', 'Zorzal', 'z');
    expect(reconcileProducts(server, [...server, local], { p9: true }).map((p) => p.id)).toEqual(['p1', 'p2', 'p9']);
  });
  it('keeps a product flagged off a moment ago out, even if the search still returns it', () => {
    expect(reconcileProducts(server, server, { p2: false }).map((p) => p.id)).toEqual(['p1']);
  });
  it('prefers the fresh server data for products it does return', () => {
    const fresh = [product('p1', 'Bolivia fresh', 'a')];
    expect(reconcileProducts(fresh, [product('p1', 'Bolivia old', 'a')], { p1: true })[0]?.title).toBe('Bolivia fresh');
  });
  it('ignores an on-override for a product that is gone locally', () => {
    expect(reconcileProducts(server, [], { p9: true }).map((p) => p.id)).toEqual(['p1', 'p2']);
  });
});
