import type { StockMap, Variant } from './types';

export const MAIN = 'loc-main';
export const SHOP = 'loc-shop';

const mini = (id: string, title: string): Variant => ({
  id,
  title,
  sku: `MINI-${id.toUpperCase()}`,
  barcode: `99${id.length}${id}`,
  collectionIds: ['c-mini'],
});

export const dark = mini('dark', 'Dark 70%');
export const milk = mini('milk', 'Milk Classic');
export const mint = mini('mint', 'Mint Dark');

export const kit6: Variant = {
  id: 'kit6',
  title: 'Sampler Kit - 6 Pack',
  sku: 'SMP-6',
  barcode: '111',
  collectionIds: ['c-kit'],
  kitSize: 6,
};

export const kit12: Variant = { ...kit6, id: 'kit12', title: 'Sampler Kit - 12 Pack', sku: 'SMP-12', barcode: '112', kitSize: 12 };

export const variantsById = Object.fromEntries(
  [dark, milk, mint, kit6, kit12].map((v) => [v.id, v]),
);

export const baseStock = (): StockMap => ({
  dark: { [MAIN]: 20, [SHOP]: 5 },
  milk: { [MAIN]: 10 },
  mint: { [MAIN]: 3, [SHOP]: 0 },
  kit6: { [MAIN]: 4 },
  kit12: { [MAIN]: 0 },
});
