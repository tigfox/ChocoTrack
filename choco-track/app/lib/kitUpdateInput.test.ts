import { parseKitUpdate } from './kitUpdateInput';

const base = { kitId: 'gid://shopify/ProductVariant/1', title: ' Milk 5 ', size: 5, categoryId: 'gid://shopify/Collection/3' };

describe('parseKitUpdate', () => {
  it('accepts and trims a valid edit', () => {
    expect(parseKitUpdate(base)).toEqual({
      ok: true,
      value: { variantId: 'gid://shopify/ProductVariant/1', title: 'Milk 5', size: 5, categoryId: 'gid://shopify/Collection/3' },
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
    ['bad size', { ...base, size: 7 }, 'Choose a kit size.'],
    ['string size', { ...base, size: '5' }, 'Choose a kit size.'],
    ['bad category', { ...base, categoryId: 'dark' }, 'Choose a valid category.'],
  ])('rejects %s', (_n, raw, error) => {
    expect(parseKitUpdate(raw)).toEqual({ ok: false, error });
  });
});
