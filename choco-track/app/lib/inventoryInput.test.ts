import { parseFlagInput, parsePackSizesInput, parseSourcesInput, parseTargetsInput, parseTransferInput } from './inventoryInput';

const P = 'gid://shopify/Product/1';
const V = 'gid://shopify/ProductVariant/2';
const L1 = 'gid://shopify/Location/10';
const L2 = 'gid://shopify/Location/11';

describe('parseFlagInput', () => {
  it('accepts a product id and a boolean', () => {
    expect(parseFlagInput({ productId: P, tracked: true })).toEqual({ ok: true, value: { productId: P, tracked: true } });
    expect(parseFlagInput({ productId: P, tracked: false })).toMatchObject({ ok: true });
  });
  it.each([['not an object', 'x'], ['null', null], ['bad id', { productId: V, tracked: true }], ['no boolean', { productId: P, tracked: 'yes' }]])(
    'rejects %s',
    (_n, raw) => expect(parseFlagInput(raw)).toEqual({ ok: false, error: 'Invalid request.' }),
  );
});

describe('parseTargetsInput', () => {
  const body = { variantId: V, digest: 'dg', targets: { [L1]: { min: 2, max: 9 }, [L2]: null } };
  it('keeps targets, drops nulls, and passes the digest through', () => {
    expect(parseTargetsInput(body)).toEqual({
      ok: true,
      value: { variantId: V, digest: 'dg', targets: { [L1]: { min: 2, max: 9 } } },
    });
  });
  it('accepts a null digest (a variant with no targets yet) and an empty set', () => {
    expect(parseTargetsInput({ ...body, digest: null, targets: {} })).toEqual({ ok: true, value: { variantId: V, digest: null, targets: {} } });
  });
  it.each([
    ['not an object', 'x', 'Invalid request.'],
    ['bad variant id', { ...body, variantId: P }, 'Invalid request.'],
    ['missing digest', { variantId: V, targets: {} }, 'Invalid request.'],
    ['digest too long', { ...body, digest: 'x'.repeat(300) }, 'Invalid request.'],
    ['targets not an object', { ...body, targets: [] }, 'Invalid request.'],
    ['bad location id', { ...body, targets: { nope: { min: 1, max: 2 } } }, 'Invalid request.'],
    ['target not an object', { ...body, targets: { [L1]: 5 } }, 'Invalid request.'],
    ['text numbers', { ...body, targets: { [L1]: { min: '1', max: 2 } } }, 'Invalid request.'],
    ['max below min', { ...body, targets: { [L1]: { min: 5, max: 2 } } }, 'Maximum must be at least the minimum.'],
    ['fraction', { ...body, targets: { [L1]: { min: 1.5, max: 2 } } }, 'Minimum must be a whole number.'],
  ])('rejects %s', (_n, raw, error) => expect(parseTargetsInput(raw)).toEqual({ ok: false, error }));
  it('limits how many locations one request can carry', () => {
    const many = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`gid://shopify/Location/${i}`, { min: 1, max: 2 }]));
    expect(parseTargetsInput({ ...body, targets: many })).toEqual({ ok: false, error: 'Invalid request.' });
  });
});

describe('parseSourcesInput', () => {
  it('accepts an ordered list of location ids', () => {
    expect(parseSourcesInput({ sourceIds: [L2, L1] })).toEqual({ ok: true, value: { sourceIds: [L2, L1] } });
    expect(parseSourcesInput({ sourceIds: [] })).toMatchObject({ ok: true });
  });
  it.each([['no list', {}], ['not ids', { sourceIds: ['x'] }], ['duplicates', { sourceIds: [L1, L1] }], ['too many', { sourceIds: Array.from({ length: 30 }, (_, i) => `gid://shopify/Location/${i}`) }]])(
    'rejects %s',
    (_n, raw) => expect(parseSourcesInput(raw)).toEqual({ ok: false, error: 'Invalid request.' }),
  );
});

describe('parsePackSizesInput', () => {
  const V = (n: number) => `gid://shopify/ProductVariant/${n}`;
  const ok = { defaultSize: 1, groups: [{ size: 5, variantIds: [V(1), V(2)] }, { size: 100, variantIds: [V(3)] }] };
  it('accepts a default and groups of variants', () => {
    expect(parsePackSizesInput(ok)).toEqual({ ok: true, value: { packSizes: ok } });
    expect(parsePackSizesInput({ defaultSize: 12, groups: [] })).toEqual({ ok: true, value: { packSizes: { defaultSize: 12, groups: [] } } });
  });
  it('gives the same messages as the screen for bad numbers', () => {
    expect(parsePackSizesInput({ ...ok, defaultSize: 0 })).toEqual({ ok: false, error: 'Enter a whole number from 1 to 1000.' });
    expect(parsePackSizesInput({ defaultSize: 1, groups: [{ size: 2.5, variantIds: [] }] })).toEqual({ ok: false, error: 'Enter a whole number from 1 to 1000.' });
  });
  it('refuses a variant listed in two groups, with a clear message', () => {
    const twice = { defaultSize: 1, groups: [{ size: 5, variantIds: [V(1)] }, { size: 7, variantIds: [V(1)] }] };
    expect(parsePackSizesInput(twice)).toEqual({ ok: false, error: 'A variant can be in only one pack size group.' });
  });
  it.each([
    ['not an object', 'x'],
    ['no default', { groups: [] }],
    ['no groups list', { defaultSize: 1 }],
    ['a group that is not an object', { defaultSize: 1, groups: ['x'] }],
    ['a group without a size', { defaultSize: 1, groups: [{ variantIds: [] }] }],
    ['a group without a list', { defaultSize: 1, groups: [{ size: 5 }] }],
    ['an id that is not a variant', { defaultSize: 1, groups: [{ size: 5, variantIds: ['gid://shopify/Product/1'] }] }],
    ['too many groups', { defaultSize: 1, groups: Array.from({ length: 21 }, () => ({ size: 5, variantIds: [] })) }],
    ['too many variants', { defaultSize: 1, groups: [{ size: 5, variantIds: Array.from({ length: 2001 }, (_, i) => V(i + 1)) }] }],
  ])('rejects %s', (_n, raw) => expect(parsePackSizesInput(raw)).toMatchObject({ ok: false }));
});

describe('parseTransferInput', () => {
  const key = 'abcdef12-3456';
  it('accepts a key alone, or with a route', () => {
    expect(parseTransferInput({ key })).toEqual({ ok: true, value: { key } });
    expect(parseTransferInput({ key, originId: L1, destinationId: L2 })).toEqual({ ok: true, value: { key, originId: L1, destinationId: L2 } });
  });
  it.each([['no key', {}], ['short key', { key: 'abc' }], ['bad origin', { key, originId: 'x' }], ['bad destination', { key, destinationId: P }], ['only one end', { key, originId: L1 }]])(
    'rejects %s',
    (_n, raw) => expect(parseTransferInput(raw)).toEqual({ ok: false, error: 'Invalid request.' }),
  );
});
