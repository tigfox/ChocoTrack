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

describe('suggestTransfers in multiples', () => {
  const by5 = { multipleOf: () => 5 };
  const one = (min: number, max: number, have: number, whAvailable = 1000, over: Partial<SuggestInput> = {}) =>
    suggestTransfers(
      input({
        variants: [variant('v', { [WH]: { min: 0, max: 5000 }, [MK]: { min, max } })],
        levels: { v: { [WH]: lvl(whAvailable), [MK]: lvl(have) } },
        ...by5,
        ...over,
      }),
    );
  const qty = (r: ReturnType<typeof suggestTransfers>) => r.transfers.flatMap((t) => t.lines.map((l) => l.quantity));

  it('rounds the amount needed down to the highest multiple that does not pass the maximum', () => {
    expect(qty(one(30, 60, 23))).toEqual([35]); // need 37
    expect(qty(one(30, 60, 20))).toEqual([40]); // need 40 exactly
  });

  it('leaves the destination at or below its maximum when the minimum is still met', () => {
    expect(qty(one(20, 24, 19))).toEqual([5]); // 24
    expect(one(20, 24, 19).transfers[0]?.lines[0]).toEqual({ variantId: 'v', quantity: 5 });
  });

  it('rounds up past the maximum rather than leave a destination below its minimum, and says so', () => {
    const r = one(20, 22, 19); // rounding down gives 0 and 19 is below 20
    expect(r.transfers[0]?.lines).toEqual([{ variantId: 'v', quantity: 5, overMax: true }]); // 24
    expect(r.shortfalls).toEqual([]);
  });

  it('never leaves a destination below its minimum when the source has enough', () => {
    for (const [min, max] of [[1, 1], [3, 4], [20, 22], [20, 60], [7, 7], [10, 10], [0, 3]] as const) {
      for (let have = 0; have < min; have += 1) {
        const r = one(min, max, have);
        const q = qty(r).reduce((a, b) => a + b, 0);
        expect(q % 5).toBe(0);
        expect(have + q).toBeGreaterThanOrEqual(min);
        const lines = r.transfers.flatMap((t) => t.lines);
        if (have + q > max) expect(lines.every((l) => l.overMax === true)).toBe(true);
      }
    }
  });

  it('counts incoming stock and drafts before rounding', () => {
    const r = one(30, 60, 20, 1000, { levels: { v: { [WH]: lvl(1000), [MK]: lvl(10, 3) } }, pending: { v: { [MK]: 4 } } });
    expect(qty(r)).toEqual([40]); // have 17, need 43
  });

  it('lets a source give only multiples, rounding its surplus down', () => {
    const r = one(30, 200, 0, 347, { variants: [variant('v', { [WH]: { min: 300, max: 5000 }, [MK]: { min: 30, max: 200 } })] });
    expect(qty(r)).toEqual([45]); // surplus 47
    expect(r.shortfalls).toEqual([{ variantId: 'v', destinationId: MK, quantity: 155, stillLow: false }]);
  });

  it('splits a need across sources in multiples only', () => {
    const variants = [variant('v', { [WH]: { min: 300, max: 5000 }, [FA]: { min: 0, max: 5000 }, [MK]: { min: 20, max: 100 } })];
    const r = suggestTransfers(input({ variants, levels: { v: { [WH]: lvl(323), [FA]: lvl(31), [MK]: lvl(0) } }, ...by5 }));
    expect(r.transfers.map((t) => [t.originId, t.lines[0]?.quantity])).toEqual([[WH, 20], [FA, 30]]);
    expect(r.shortfalls).toEqual([{ variantId: 'v', destinationId: MK, quantity: 50, stillLow: false }]);
  });

  it('reports a still-low shortfall when the sources cannot reach the minimum in multiples', () => {
    const r = one(20, 60, 12, 304, { variants: [variant('v', { [WH]: { min: 300, max: 5000 }, [MK]: { min: 20, max: 60 } })] });
    expect(r.transfers).toEqual([]); // surplus 4 rounds to 0
    expect(r.shortfalls).toEqual([{ variantId: 'v', destinationId: MK, quantity: 45, stillLow: true }]);
  });

  it('rounds a source with no target down too', () => {
    const variants = [variant('v', { [MK]: { min: 20, max: 60 } })];
    const r = suggestTransfers(input({ variants, levels: { v: { [WH]: lvl(33), [MK]: lvl(12) } }, ...by5 }));
    expect(qty(r)).toEqual([30]);
  });

  it('uses a different multiple per variant', () => {
    const variants = [
      { ...variant('full', { [WH]: { min: 0, max: 5000 }, [MK]: { min: 20, max: 60 } }), title: 'Full' },
      variant('mini', { [WH]: { min: 0, max: 5000 }, [MK]: { min: 20, max: 200 } }),
    ];
    const levels = { full: { [WH]: lvl(1000), [MK]: lvl(1) }, mini: { [WH]: lvl(1000), [MK]: lvl(1) } };
    const multipleOf = (v: { title: string }) => (v.title === 'Full' ? 5 : 25);
    const r = suggestTransfers(input({ variants, levels, multipleOf }));
    expect(r.transfers[0]?.lines).toEqual([
      { variantId: 'full', quantity: 55 }, // need 59
      { variantId: 'mini', quantity: 175 }, // need 199
    ]);
  });

  it('treats a multiple of 1, or an unusable multiple, as no rounding', () => {
    for (const m of [1, 0, -5, 2.5, Number.NaN]) {
      expect(qty(one(30, 60, 23, 1000, { multipleOf: () => m }))).toEqual([37]);
    }
  });

  it('does not modify its input', () => {
    const frozen = input(by5);
    const deepFreeze = (o: unknown): void => {
      if (o && typeof o === 'object') Object.values(o).forEach(deepFreeze), Object.freeze(o);
    };
    deepFreeze(frozen);
    expect(() => suggestTransfers(frozen)).not.toThrow();
  });
});
