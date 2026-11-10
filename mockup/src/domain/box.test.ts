import { boxLayout, boxSlots } from './box';
import { dark, kit12, kit6, milk, mint } from './fixtures';
import type { Variant } from './types';

const kit4: Variant = { ...kit6, id: 'kit4', title: 'Sampler Kit - 4 Pack', sku: 'SMP-4', kitSize: 4 };
const catalog = [dark, milk, mint];

describe('boxLayout', () => {
  it.each([
    [4, { rows: 1, cols: 4 }],
    [6, { rows: 1, cols: 6 }],
    [12, { rows: 2, cols: 6 }],
  ] as const)('%s bars -> %o', (size, layout) => {
    expect(boxLayout(size)).toEqual(layout);
  });
});

describe('boxSlots', () => {
  it('is empty without a kit', () => {
    expect(boxSlots(undefined, { dark: 2 }, catalog)).toEqual([]);
  });
  it('has one empty slot per bar when nothing is chosen', () => {
    expect(boxSlots(kit6, {}, catalog)).toEqual([null, null, null, null, null, null]);
  });
  it('repeats each flavor by its quantity and pads with empty slots', () => {
    const slots = boxSlots(kit4, { [dark.id]: 2, [mint.id]: 1 }, catalog);
    expect(slots.map((s) => s?.variantId ?? null)).toEqual(['dark', 'dark', 'mint', null]);
  });
  it('orders by catalog order, not by the order flavors were chosen', () => {
    const slots = boxSlots(kit4, { [mint.id]: 1, [dark.id]: 1 }, catalog);
    expect(slots.map((s) => s?.variantId ?? null)).toEqual(['dark', 'mint', null, null]);
  });
  it('truncates to the kit size when over-filled', () => {
    const slots = boxSlots(kit4, { [dark.id]: 3, [milk.id]: 3 }, catalog);
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s !== null)).toBe(true);
  });
  it('ignores zero, negative and fractional leftovers', () => {
    const slots = boxSlots(kit12, { [dark.id]: 0, [milk.id]: -2, [mint.id]: 1.5 }, catalog);
    expect(slots.filter((s) => s !== null)).toHaveLength(1);
    expect(slots).toHaveLength(12);
  });
  it('carries title and image for rendering', () => {
    const withImage = { ...dark, imageUrl: '/x.svg' };
    expect(boxSlots(kit4, { [dark.id]: 1 }, [withImage])[0]).toEqual({ variantId: 'dark', title: dark.title, imageUrl: '/x.svg' });
  });
});
