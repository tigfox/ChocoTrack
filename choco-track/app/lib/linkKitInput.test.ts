import { parseLinkKit } from './linkKitInput';

const base = { variantId: 'gid://shopify/ProductVariant/1', size: 12, categoryId: 'gid://shopify/Collection/3' };

describe('parseLinkKit', () => {
  it('accepts a valid link request', () => {
    expect(parseLinkKit(base)).toEqual({ ok: true, value: { variantId: base.variantId, size: 12, categoryId: base.categoryId } });
  });
  it('maps an empty or missing category to none', () => {
    expect(parseLinkKit({ ...base, categoryId: '' })).toMatchObject({ ok: true, value: { categoryId: null } });
    expect(parseLinkKit({ ...base, categoryId: undefined })).toMatchObject({ ok: true, value: { categoryId: null } });
  });
  it.each([
    ['not an object', 'x', 'Invalid request.'],
    ['array', [], 'Invalid request.'],
    ['missing variant', { ...base, variantId: undefined }, 'Choose the product to use as a kit.'],
    ['product id instead of variant', { ...base, variantId: 'gid://shopify/Product/1' }, 'Choose the product to use as a kit.'],
    ['zero size', { ...base, size: 0 }, 'Enter a whole number from 1 to 48.'],
    ['string size', { ...base, size: '12' }, 'Enter a whole number from 1 to 48.'],
    ['bad category', { ...base, categoryId: 'dark' }, 'Choose a valid category.'],
  ])('rejects %s', (_n, raw, error) => {
    expect(parseLinkKit(raw)).toEqual({ ok: false, error });
  });
});
