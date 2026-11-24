import { actualStockKey, parseInventory } from './riverSeaInventory';

const rec = (o: Record<string, string>): Record<string, string> => ({ Handle: 'guatemala-72', 'Option1 Value': '60g Bar', 'Option2 Value': '', 'Option3 Value': '', ...o });

describe('parseInventory', () => {
  const map = parseInventory([
    rec({ Location: 'River-Sea Chocolates Reston', 'On hand (current)': '442' }),
    rec({ Location: 'River-Sea Chocolates Chantilly', 'On hand (current)': '58' }),
    rec({ Location: 'Union Market', 'On hand (current)': 'not stocked' }),
    rec({ Location: 'Myterra Warehouse', 'On hand (current)': 'not fulfilled' }),
    rec({ Handle: 'mini-sampler-box', 'Option1 Value': 'Box', Location: 'Union Market', 'On hand (current)': '-5' }),
  ]);
  it('maps export locations to dev-store locations and keeps numeric counts', () => {
    expect(map.get(actualStockKey('guatemala-72', ['60g Bar']))).toEqual({ Factory: 442, Cafe: 58 });
  });
  it('clamps negative counts to zero', () => {
    expect(map.get(actualStockKey('mini-sampler-box', ['Box']))).toEqual({ 'Market Store': 0 });
  });
  it('has no entry for a variant with no numeric counts', () => {
    expect(map.get(actualStockKey('nothing', ['x']))).toBeUndefined();
  });
  it('rejects an unknown location', () => {
    expect(() => parseInventory([rec({ Location: 'Moon Base', 'On hand (current)': '1' })])).toThrow(/Moon Base/);
  });
});
