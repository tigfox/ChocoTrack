import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { INITIAL_VARIANTS, LOCATIONS, indexById, initialStock } from './catalog';

describe('catalog', () => {
  it('has 23 mini flavors and three kit sizes', () => {
    expect(INITIAL_VARIANTS.filter((v) => v.collectionIds.includes('c-mini'))).toHaveLength(23);
    expect(INITIAL_VARIANTS.filter((v) => v.kitSize).map((v) => v.kitSize)).toEqual([4, 6, 12]);
  });
  it('gives every mini bar an image that exists on disk', () => {
    const minis = INITIAL_VARIANTS.filter((v) => v.collectionIds.includes('c-mini'));
    for (const v of minis) {
      expect(v.imageUrl).toMatch(/^\/images\/mini\/.+\.svg$/);
      expect(existsSync(join(process.cwd(), 'public', v.imageUrl ?? ''))).toBe(true);
    }
  });
  it('has unique ids, SKUs and barcodes', () => {
    for (const key of ['id', 'sku', 'barcode'] as const) {
      const values = INITIAL_VARIANTS.map((v) => v[key]);
      expect(new Set(values).size).toBe(values.length);
    }
  });
  it('has stock rows for every variant using known locations', () => {
    const stock = initialStock();
    const locations = new Set(LOCATIONS.map((l) => l.id));
    for (const v of INITIAL_VARIANTS) {
      const row = stock[v.id];
      expect(row).toBeDefined();
      Object.keys(row ?? {}).forEach((loc) => expect(locations.has(loc)).toBe(true));
    }
  });
  it('indexes by id', () => {
    expect(indexById(INITIAL_VARIANTS)['v-kit-smp-6']?.sku).toBe('SMP-6');
  });
});
