import { computeLowCount, forgetLowCount, LOW_COUNT_TTL_MS, readLowCount } from './lowCount';
import type { ReportProduct } from '../shopify/trackedCatalog';

describe('readLowCount', () => {
  afterEach(() => forgetLowCount('a.myshopify.com'));

  it('computes once and reuses the answer until it expires', async () => {
    const compute = vi.fn().mockResolvedValue(3);
    expect(await readLowCount('a.myshopify.com', compute, 1_000)).toBe(3);
    expect(await readLowCount('a.myshopify.com', compute, 1_000 + LOW_COUNT_TTL_MS - 1)).toBe(3);
    expect(compute).toHaveBeenCalledTimes(1);
    compute.mockResolvedValue(5);
    expect(await readLowCount('a.myshopify.com', compute, 1_000 + LOW_COUNT_TTL_MS)).toBe(5);
    expect(compute).toHaveBeenCalledTimes(2);
  });
  it('keeps shops apart and forgets on request', async () => {
    const a = vi.fn().mockResolvedValue(1);
    const b = vi.fn().mockResolvedValue(2);
    expect(await readLowCount('a.myshopify.com', a, 0)).toBe(1);
    expect(await readLowCount('b.myshopify.com', b, 0)).toBe(2);
    forgetLowCount('a.myshopify.com');
    await readLowCount('a.myshopify.com', a, 1);
    expect(a).toHaveBeenCalledTimes(2);
    forgetLowCount('b.myshopify.com');
  });
  it('does not cache a failure', async () => {
    const compute = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(4);
    await expect(readLowCount('a.myshopify.com', compute, 0)).rejects.toThrow('x');
    expect(await readLowCount('a.myshopify.com', compute, 1)).toBe(4);
  });
});

describe('computeLowCount', () => {
  const product: ReportProduct = {
    id: 'p',
    title: 'Rum',
    truncated: false,
    variants: [
      { id: 'a', productId: 'p', productTitle: 'Rum', title: 'Mini', sku: 'a', inventoryItemId: 'ia', digest: null, targets: { L: { min: 10, max: 20 } } },
      { id: 'b', productId: 'p', productTitle: 'Rum', title: 'Full', sku: 'b', inventoryItemId: 'ib', digest: null, targets: {} },
    ],
  };
  it('counts tracked variants that are low somewhere', () => {
    const report = { products: [product], levels: { a: { L: { available: 2, incoming: 0 } }, b: { L: { available: 0, incoming: 0 } } }, pending: {} };
    expect(computeLowCount(report)).toBe(1);
    expect(computeLowCount({ ...report, levels: { a: { L: { available: 12, incoming: 0 } } } })).toBe(0);
  });
});
