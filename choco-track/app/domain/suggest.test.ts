import { suggestTransfers, type SuggestInput } from './suggest';
import type { TrackedVariant } from './tracking';

const WH = 'WH'; // source
const FA = 'FA'; // source
const MK = 'MK'; // destination
const CF = 'CF'; // destination

const variant = (id: string, targets: TrackedVariant['targets']): TrackedVariant => ({
  id,
  productId: `p-${id}`,
  productTitle: id,
  title: 'Mini',
  sku: id,
  targets,
});
const lvl = (available: number, incoming = 0) => ({ available, incoming });

const input = (over: Partial<SuggestInput> = {}): SuggestInput => ({
  variants: [variant('v', { [WH]: { min: 300, max: 500 }, [MK]: { min: 20, max: 60 } })],
  levels: { v: { [WH]: lvl(420), [MK]: lvl(12) } },
  pending: {},
  sourceIds: [WH, FA],
  locationIds: [WH, FA, MK, CF],
  ...over,
});

describe('suggestTransfers', () => {
  it('suggests nothing when every destination is at or above its minimum', () => {
    const r = suggestTransfers(input({ levels: { v: { [WH]: lvl(420), [MK]: lvl(20) } } }));
    expect(r).toEqual({ transfers: [], shortfalls: [] });
  });

  it('fills a low destination up to its maximum from a source, keeping the source at its minimum', () => {
    const r = suggestTransfers(input());
    expect(r.transfers).toEqual([{ originId: WH, destinationId: MK, lines: [{ variantId: 'v', quantity: 48 }] }]);
    expect(r.shortfalls).toEqual([]);
  });

  it('counts incoming stock and pending drafts as already on the way', () => {
    expect(suggestTransfers(input({ levels: { v: { [WH]: lvl(420), [MK]: lvl(12, 40) } } })).transfers).toEqual([]);
    // A draft of 10 lifts 12 to 22, above the minimum of 20, so nothing more is suggested.
    expect(suggestTransfers(input({ pending: { v: { [MK]: 10 } } })).transfers).toEqual([]);
    // A draft of 5 leaves it at 17, still below the minimum: top up to the maximum from there.
    const withDraft = suggestTransfers(input({ pending: { v: { [MK]: 5 } } }));
    expect(withDraft.transfers[0]?.lines[0]?.quantity).toBe(43); // 60 - (12 + 5)
  });

  it('limits a source to what it has above its own minimum and reports the rest as a shortfall', () => {
    const r = suggestTransfers(input({ levels: { v: { [WH]: lvl(310), [MK]: lvl(12) } } }));
    expect(r.transfers).toEqual([{ originId: WH, destinationId: MK, lines: [{ variantId: 'v', quantity: 10 }] }]);
    expect(r.shortfalls).toEqual([{ variantId: 'v', destinationId: MK, quantity: 38, stillLow: false }]); // 12 + 10 >= 20
  });

  it('flags a shortfall that leaves the destination below its minimum', () => {
    const r = suggestTransfers(input({ levels: { v: { [WH]: lvl(305), [MK]: lvl(12) } } }));
    expect(r.shortfalls).toEqual([{ variantId: 'v', destinationId: MK, quantity: 43, stillLow: true }]); // 12 + 5 < 20
  });

  it('draws from sources in order, one transfer per source', () => {
    const variants = [variant('v', { [WH]: { min: 300, max: 500 }, [FA]: { min: 0, max: 100 }, [MK]: { min: 20, max: 60 } })];
    const r = suggestTransfers(input({ variants, levels: { v: { [WH]: lvl(310), [FA]: lvl(100), [MK]: lvl(12) } } }));
    expect(r.transfers).toEqual([
      { originId: WH, destinationId: MK, lines: [{ variantId: 'v', quantity: 10 }] },
      { originId: FA, destinationId: MK, lines: [{ variantId: 'v', quantity: 38 }] },
    ]);
    expect(r.shortfalls).toEqual([]);
  });

  it('serves destinations in location order and shares a source between them', () => {
    const variants = [variant('v', { [WH]: { min: 300, max: 500 }, [MK]: { min: 20, max: 60 }, [CF]: { min: 10, max: 40 } })];
    const r = suggestTransfers(
      input({ variants, levels: { v: { [WH]: lvl(360), [MK]: lvl(12), [CF]: lvl(0) } } }), // surplus 60
    );
    expect(r.transfers).toEqual([
      { originId: WH, destinationId: MK, lines: [{ variantId: 'v', quantity: 48 }] },
      { originId: WH, destinationId: CF, lines: [{ variantId: 'v', quantity: 12 }] },
    ]);
    expect(r.shortfalls).toEqual([{ variantId: 'v', destinationId: CF, quantity: 28, stillLow: false }]); // 12 >= its minimum of 10
  });

  it('treats a source with no target as free to give all its stock', () => {
    const variants = [variant('v', { [MK]: { min: 20, max: 60 } })];
    const r = suggestTransfers(input({ variants, levels: { v: { [WH]: lvl(30), [MK]: lvl(12) } } }));
    expect(r.transfers[0]?.lines[0]?.quantity).toBe(30);
  });

  it('never sends to a source location, even one that is low', () => {
    const r = suggestTransfers(input({ levels: { v: { [WH]: lvl(5), [FA]: lvl(900), [MK]: lvl(60) } } }));
    expect(r.transfers).toEqual([]);
  });

  it('treats a destination that does not stock the item as 0 available', () => {
    const r = suggestTransfers(input({ levels: { v: { [WH]: lvl(420) } } }));
    expect(r.transfers).toEqual([{ originId: WH, destinationId: MK, lines: [{ variantId: 'v', quantity: 60 }] }]);
  });

  it('skips destinations without a target and variants without any targets', () => {
    const variants = [variant('v', { [WH]: { min: 300, max: 500 } }), variant('w', {})];
    const r = suggestTransfers(input({ variants, levels: { v: { [WH]: lvl(420), [MK]: lvl(0) }, w: { [WH]: lvl(9), [MK]: lvl(0) } } }));
    expect(r).toEqual({ transfers: [], shortfalls: [] });
  });

  it('combines several variants for the same route into one transfer', () => {
    const variants = [
      variant('a', { [WH]: { min: 0, max: 100 }, [MK]: { min: 10, max: 20 } }),
      variant('b', { [WH]: { min: 0, max: 100 }, [MK]: { min: 5, max: 8 } }),
    ];
    const levels = { a: { [WH]: lvl(100), [MK]: lvl(0) }, b: { [WH]: lvl(100), [MK]: lvl(1) } };
    expect(suggestTransfers(input({ variants, levels })).transfers).toEqual([
      {
        originId: WH,
        destinationId: MK,
        lines: [
          { variantId: 'a', quantity: 20 },
          { variantId: 'b', quantity: 7 },
        ],
      },
    ]);
  });

  it('uses each variant surplus independently', () => {
    const variants = [
      variant('a', { [WH]: { min: 0, max: 9 }, [MK]: { min: 5, max: 10 } }),
      variant('b', { [WH]: { min: 0, max: 9 }, [MK]: { min: 5, max: 10 } }),
    ];
    const levels = { a: { [WH]: lvl(10), [MK]: lvl(0) }, b: { [WH]: lvl(10), [MK]: lvl(0) } };
    const lines = suggestTransfers(input({ variants, levels })).transfers[0]?.lines;
    expect(lines).toEqual([
      { variantId: 'a', quantity: 10 },
      { variantId: 'b', quantity: 10 },
    ]);
  });

  it('handles min equal to max', () => {
    const variants = [variant('v', { [MK]: { min: 20, max: 20 } })];
    const r = suggestTransfers(input({ variants, levels: { v: { [WH]: lvl(100), [MK]: lvl(15) } } }));
    expect(r.transfers[0]?.lines[0]?.quantity).toBe(5);
  });

  it('suggests nothing when there are no sources', () => {
    const r = suggestTransfers(input({ sourceIds: [] , locationIds: [MK, CF] }));
    expect(r.transfers).toEqual([]);
    expect(r.shortfalls).toEqual([{ variantId: 'v', destinationId: MK, quantity: 48, stillLow: true }]);
  });

  it('does not modify its input', () => {
    const frozen = input();
    const deepFreeze = (o: unknown): void => {
      if (o && typeof o === 'object') Object.values(o).forEach(deepFreeze), Object.freeze(o);
    };
    deepFreeze(frozen);
    expect(() => suggestTransfers(frozen)).not.toThrow();
  });
});
