import { parseKitUpdate } from './kitUpdateInput';

const base = { kitId: 'gid://shopify/ProductVariant/1', title: ' Milk 5 ', size: 5, categoryId: 'gid://shopify/Collection/3' };

describe('parseKitUpdate', () => {
  it('accepts and trims a valid edit', () => {
    expect(parseKitUpdate(base)).toEqual({
      ok: true,
      value: { variantId: 'gid://shopify/ProductVariant/1', title: 'Milk 5', size: 5, categoryId: 'gid://shopify/Collection/3' },
    });
  });
  it('treats a missing title as "do not rename"', () => {
    const noTitle = Object.fromEntries(Object.entries(base).filter(([key]) => key !== 'title'));
    expect(parseKitUpdate(noTitle)).toEqual({
      ok: true,
      value: { variantId: 'gid://shopify/ProductVariant/1', size: 5, categoryId: 'gid://shopify/Collection/3' },
    });
  });
  it('maps an empty or missing category to none', () => {
    expect(parseKitUpdate({ ...base, categoryId: '' })).toMatchObject({ ok: true, value: { categoryId: null } });
    expect(parseKitUpdate({ ...base, categoryId: undefined })).toMatchObject({ ok: true, value: { categoryId: null } });
  });
  it.each([
    ['not an object', 'x', 'Invalid request.'],
    ['array', [], 'Invalid request.'],
    ['bad kit id', { ...base, kitId: 'gid://shopify/Product/1' }, 'Invalid request.'],
    ['missing kit id', { ...base, kitId: undefined }, 'Invalid request.'],
    ['blank title', { ...base, title: ' ' }, 'Enter a title.'],
    ['long title', { ...base, title: 'x'.repeat(256) }, 'Enter a title.'],
    ['zero size', { ...base, size: 0 }, 'Enter a whole number from 1 to 48.'],
    ['too big', { ...base, size: 49 }, 'Enter a whole number from 1 to 48.'],
    ['fraction', { ...base, size: 2.5 }, 'Enter a whole number from 1 to 48.'],
    ['string size', { ...base, size: '5' }, 'Enter a whole number from 1 to 48.'],
    ['bad category', { ...base, categoryId: 'dark' }, 'Choose a valid category.'],
  ])('rejects %s', (_n, raw, error) => {
    expect(parseKitUpdate(raw)).toEqual({ ok: false, error });
  });
});

describe('parseKitUpdate with any size', () => {
  it('accepts sizes outside the old 4, 5, 6 and 12', () => {
    expect(parseKitUpdate({ ...base, size: 8 })).toMatchObject({ ok: true, value: { size: 8 } });
  });
});
