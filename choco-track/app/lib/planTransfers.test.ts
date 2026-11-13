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
});
