import { addGroup, draftError, fromDraft, removeGroup, sameDraft, setGroupSize, toDraft } from './packSizeDraft';
import type { PackSizes } from '../domain/packSizes';

const V = (n: number) => `gid://shopify/ProductVariant/${n}`;
const saved: PackSizes = { defaultSize: 1, groups: [{ size: 5, variantIds: [V(1)] }, { size: 100, variantIds: [V(2), V(3)] }] };

describe('toDraft / fromDraft', () => {
  it('round-trips the saved settings', () => {
    expect(fromDraft(toDraft(saved))).toEqual(saved);
  });
  it('turns numbers into the text fields show', () => {
    expect(toDraft(saved)).toMatchObject({ defaultSize: '1', groups: [{ size: '5' }, { size: '100' }] });
  });
});

describe('addGroup / removeGroup / setGroupSize', () => {
  it('adds an empty group with a fresh key, without changing the original', () => {
    const draft = toDraft(saved);
    const next = addGroup(draft);
    expect(next.groups).toHaveLength(3);
    expect(next.groups[2]).toMatchObject({ size: '', variantIds: [] });
    expect(new Set(next.groups.map((g) => g.key)).size).toBe(3);
    expect(draft.groups).toHaveLength(2);
  });
  it('keeps keys unique after a removal and another add', () => {
    const next = addGroup(removeGroup(toDraft(saved), 0));
    expect(new Set(next.groups.map((g) => g.key)).size).toBe(next.groups.length);
  });
  it('removes a group by index and edits one size', () => {
    expect(removeGroup(toDraft(saved), 0).groups.map((g) => g.size)).toEqual(['100']);
    expect(setGroupSize(toDraft(saved), 1, '50').groups.map((g) => g.size)).toEqual(['5', '50']);
  });
});

describe('draftError', () => {
  it('is undefined for a valid draft', () => {
    expect(draftError(toDraft(saved))).toBeUndefined();
  });
  it('reports a bad default', () => {
    expect(draftError({ ...toDraft(saved), defaultSize: '0' })).toBe('Enter a whole number from 1 to 1000.');
    expect(draftError({ ...toDraft(saved), defaultSize: '' })).toBe('Enter a whole number from 1 to 1000.');
  });
  it('reports a group with no size yet', () => {
    expect(draftError(addGroup(toDraft(saved)))).toBe('Enter a pack size for every group.');
  });
  it('reports a bad group size', () => {
    expect(draftError(setGroupSize(toDraft(saved), 0, '2.5'))).toBe('Enter a whole number from 1 to 1000.');
  });
});

describe('sameDraft', () => {
  it('ignores keys but notices size, default and members', () => {
    expect(sameDraft(toDraft(saved), toDraft(saved))).toBe(true);
    expect(sameDraft(toDraft(saved), setGroupSize(toDraft(saved), 0, '6'))).toBe(false);
    expect(sameDraft(toDraft(saved), { ...toDraft(saved), defaultSize: '2' })).toBe(false);
    expect(sameDraft(toDraft(saved), toDraft({ ...saved, groups: [saved.groups[0]!, { size: 100, variantIds: [V(2)] }] }))).toBe(false);
    expect(sameDraft(toDraft(saved), removeGroup(toDraft(saved), 1))).toBe(false);
  });
});
