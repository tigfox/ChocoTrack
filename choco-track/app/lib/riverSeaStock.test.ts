import { planStock, STOCK_LOCATIONS } from './riverSeaStock';
import type { ExportProduct, ExportVariant } from './riverSeaExport';

const variant = (o: Partial<ExportVariant>): ExportVariant => ({
  optionValues: ['x'], sku: '', barcodes: [], grams: null, tracked: true, policy: 'DENY', requiresShipping: true, taxable: true,
  price: '1.00', compareAt: '', cost: '', image: '', ...o,
});
const product = (handle: string, variants: ExportVariant[], optionNames = ['Title']): Pick<ExportProduct, 'handle' | 'optionNames' | 'variants'> => ({ handle, optionNames, variants });
const ids = Object.fromEntries(STOCK_LOCATIONS.map((n) => [n, `gid://loc/${n}`]));
const qty = (p: ReturnType<typeof product>, i: number) => planStock(p, p.variants[i] as ExportVariant, ids, () => 0.5);

describe('planStock', () => {
  it('gives 60g bars 1500 at Warehouse, 500 Factory, 50 Market Store, 50 Cafe', () => {
    const p = product('guatemala-72', [variant({ optionValues: ['60g Bar'] })], ['Quantity']);
    expect(qty(p, 0)).toEqual([
      { locationId: ids.Warehouse, name: 'available', quantity: 1500 },
      { locationId: ids.Factory, name: 'available', quantity: 500 },
      { locationId: ids['Market Store'], name: 'available', quantity: 50 },
      { locationId: ids.Cafe, name: 'available', quantity: 50 },
    ]);
  });
  it('gives mini flavor variants 1500 at Factory only', () => {
    const p = product('mini-bars-milks', [variant({ optionValues: ['organic-milk'] })], ['Flavor']);
    expect(qty(p, 0)).toEqual([{ locationId: ids.Factory, name: 'available', quantity: 1500 }]);
  });
  it('stocks mini variants even when the export has them untracked', () => {
    const p = product('mini-bars-rare', [variant({ tracked: false })], ['Flavor']);
    expect(qty(p, 0)).toEqual([{ locationId: ids.Factory, name: 'available', quantity: 1500 }]);
  });
  it('treats the white chocolate minis as minis', () => {
    const p = product('mini-bars-white-chocolate', [variant({})]);
    expect(qty(p, 0)).toEqual([{ locationId: ids.Factory, name: 'available', quantity: 1500 }]);
  });
  it('randomizes everything else between 10 and 50 at every location', () => {
    const p = product('mini-sampler-box', [variant({})]);
    const lo = planStock(p, p.variants[0] as ExportVariant, ids, () => 0);
    const hi = planStock(p, p.variants[0] as ExportVariant, ids, () => 0.999999);
    expect(lo.map((l) => l.quantity)).toEqual([10, 10, 10, 10]);
    expect(hi.map((l) => l.quantity)).toEqual([50, 50, 50, 50]);
  });
  it('uses real counts when given, ignoring the rules', () => {
    const p = product('guatemala-72', [variant({})]);
    expect(planStock(p, p.variants[0] as ExportVariant, ids, () => 0, { Factory: 442, Cafe: 0 })).toEqual([
      { locationId: ids.Factory, name: 'available', quantity: 442 },
      { locationId: ids.Cafe, name: 'available', quantity: 0 },
    ]);
  });
  it('stocks nothing for untracked variants', () => {
    const p = product('x', [variant({ tracked: false, optionValues: ['60g Bar'] })], ['Quantity']);
    expect(qty(p, 0)).toEqual([]);
  });
  it('fails when a location is missing', () => {
    const p = product('x', [variant({})]);
    expect(() => planStock(p, p.variants[0] as ExportVariant, { Warehouse: 'a' }, () => 0)).toThrow(/location/i);
  });
});
