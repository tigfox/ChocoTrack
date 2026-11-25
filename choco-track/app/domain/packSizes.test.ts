import {
  DEFAULT_PACK_SIZES,
  moveToGroup,
  packSizeFor,
  parsePackSizes,
  removeFromGroup,
  serializePackSizes,
  validatePackSize,
  type PackSizes,
} from './packSizes';

const V = (n: number) => `gid://shopify/ProductVariant/${n}`;
const sizes: PackSizes = { defaultSize: 1, groups: [{ size: 5, variantIds: [V(1), V(2)] }, { size: 100, variantIds: [V(3)] }] };

describe('DEFAULT_PACK_SIZES', () => {
  it('ships one at a time with no groups', () => {
    expect(DEFAULT_PACK_SIZES).toEqual({ defaultSize: 1, groups: [] });
  });
});

describe('validatePackSize', () => {
  it.each([1, 5, 100, 1000])('accepts %s', (n) => expect(validatePackSize(n)).toBeUndefined());
  it.each([0, -1, 1001, 2.5, Number.NaN])('rejects %s', (n) => expect(validatePackSize(n)).toBe('Enter a whole number from 1 to 1000.'));
});

describe('packSizeFor', () => {
  it('uses the size of the group the variant is in', () => {
    expect(packSizeFor(sizes, V(1))).toBe(5);
    expect(packSizeFor(sizes, V(3))).toBe(100);
  });
  it('uses the default for a variant in no group', () => {
    expect(packSizeFor(sizes, V(9))).toBe(1);
    expect(packSizeFor({ ...sizes, defaultSize: 12 }, V(9))).toBe(12);
  });
  it('uses the first group when a variant is listed twice', () => {
    expect(packSizeFor({ defaultSize: 1, groups: [{ size: 5, variantIds: [V(1)] }, { size: 7, variantIds: [V(1)] }] }, V(1))).toBe(5);
  });
});

describe('parsePackSizes', () => {
  it('round-trips through serializePackSizes', () => {
    expect(parsePackSizes(serializePackSizes(sizes))).toEqual(sizes);
  });
  it('gives the defaults for missing, unreadable or old-format text', () => {
    expect(parsePackSizes(null)).toEqual(DEFAULT_PACK_SIZES);
    expect(parsePackSizes('not json')).toEqual(DEFAULT_PACK_SIZES);
    expect(parsePackSizes('[]')).toEqual(DEFAULT_PACK_SIZES);
    expect(parsePackSizes(JSON.stringify({ default: 5, byName: { mini: 100 } }))).toEqual({ defaultSize: 5, groups: [] });
  });
  it('drops bad groups and bad ids instead of failing', () => {
    const raw = JSON.stringify({
      default: 0,
      groups: [{ size: 5, variantIds: [V(1), 7, ''] }, { size: 0, variantIds: [V(2)] }, 'x', { size: 9 }],
    });
    expect(parsePackSizes(raw)).toEqual({ defaultSize: 1, groups: [{ size: 5, variantIds: [V(1)] }] });
  });
  it('keeps a variant only in the first group that lists it', () => {
    const raw = JSON.stringify({ default: 1, groups: [{ size: 5, variantIds: [V(1)] }, { size: 7, variantIds: [V(1), V(2)] }] });
    expect(parsePackSizes(raw).groups).toEqual([{ size: 5, variantIds: [V(1)] }, { size: 7, variantIds: [V(2)] }]);
  });
});

describe('serializePackSizes', () => {
  it('is stable text', () => {
    expect(serializePackSizes(DEFAULT_PACK_SIZES)).toBe('{"default":1,"groups":[]}');
  });
});

describe('moveToGroup', () => {
  const groups = sizes.groups;
  it('adds variants to a group and takes them out of every other group', () => {
    const next = moveToGroup(groups, 1, [V(1), V(4)]);
    expect(next).toEqual([{ size: 5, variantIds: [V(2)] }, { size: 100, variantIds: [V(3), V(1), V(4)] }]);
  });
  it('does not add a variant twice', () => {
    expect(moveToGroup(groups, 0, [V(1), V(1)])[0]?.variantIds).toEqual([V(1), V(2)]);
  });
  it('leaves the original untouched and ignores a bad group index', () => {
    const frozen = Object.freeze(groups.map((g) => Object.freeze({ ...g })));
    expect(moveToGroup(frozen, 5, [V(1)])).toBe(frozen);
    moveToGroup(frozen, 1, [V(1)]);
    expect(frozen[0]?.variantIds).toEqual([V(1), V(2)]);
  });
});

describe('removeFromGroup', () => {
  it('removes one variant from one group', () => {
    expect(removeFromGroup(sizes.groups, 0, V(1))[0]?.variantIds).toEqual([V(2)]);
  });
  it('leaves other groups alone', () => {
    expect(removeFromGroup(sizes.groups, 0, V(3))).toEqual(sizes.groups);
  });
});
