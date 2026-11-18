import { planTransfers } from './planTransfers';
import type { ReportProduct } from '../shopify/trackedCatalog';

const W = 'W';
const M = 'M';
const product: ReportProduct = {
  id: 'p',
  title: 'Rum',
  truncated: false,
  variants: [
    { id: 'mini', productId: 'p', productTitle: 'Rum', title: 'Mini', sku: 'm', inventoryItemId: 'im', digest: null, targets: { [W]: { min: 0, max: 100 }, [M]: { min: 10, max: 30 } } },
    { id: 'full', productId: 'p', productTitle: 'Rum', title: 'Full', sku: 'f', inventoryItemId: 'if', digest: null, targets: {} },
  ],
};

describe('planTransfers', () => {
  it('plans for tracked variants only (those with targets)', () => {
    const levels = { mini: { [W]: { available: 80, incoming: 0 }, [M]: { available: 4, incoming: 0 } }, full: { [W]: { available: 80, incoming: 0 }, [M]: { available: 0, incoming: 0 } } };
    const plan = planTransfers({ products: [product], levels, pending: {}, sourceIds: [W], locations: [{ id: W }, { id: M }] });
    expect(plan.transfers).toEqual([{ originId: W, destinationId: M, lines: [{ variantId: 'mini', quantity: 26 }] }]);
  });

  it('ships each variant in its own pack size, by variant name', () => {
    const levels = { mini: { [W]: { available: 900, incoming: 0 }, [M]: { available: 4, incoming: 0 } } };
    const wide = { ...product, variants: [{ ...product.variants[0]!, targets: { [W]: { min: 0, max: 1000 }, [M]: { min: 10, max: 330 } } }] };
    const plan = (multiples: { fallback: number; byName: Record<string, number> }) =>
      planTransfers({ products: [wide], levels, pending: {}, sourceIds: [W], locations: [{ id: W }, { id: M }], multiples }).transfers[0]?.lines[0]?.quantity;
    expect(plan({ fallback: 5, byName: { mini: 100 } })).toBe(300); // need 326
    expect(plan({ fallback: 5, byName: {} })).toBe(325);
  });

  it('does not round when no pack sizes are given', () => {
    const levels = { mini: { [W]: { available: 80, incoming: 0 }, [M]: { available: 4, incoming: 0 } } };
    expect(planTransfers({ products: [product], levels, pending: {}, sourceIds: [W], locations: [{ id: W }, { id: M }] }).transfers[0]?.lines[0]?.quantity).toBe(26);
  });
});
