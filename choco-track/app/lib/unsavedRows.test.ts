import { unsavedMessage, withDirty } from './unsavedRows';

describe('withDirty', () => {
  it('adds a row id when it becomes dirty, without changing the original list', () => {
    const before = Object.freeze(['a']);
    expect(withDirty(before, 'b', true)).toEqual(['a', 'b']);
    expect(before).toEqual(['a']);
  });
  it('removes a row id when it is no longer dirty', () => {
    expect(withDirty(['a', 'b'], 'a', false)).toEqual(['b']);
  });
  it('returns the same list when nothing changes, so React does not re-render', () => {
    const list = ['a'];
    expect(withDirty(list, 'a', true)).toBe(list);
    expect(withDirty(list, 'z', false)).toBe(list);
  });
});

describe('unsavedMessage', () => {
  it('says how many rows have unsaved changes', () => {
    expect(unsavedMessage(1)).toBe("1 row has changes you haven't saved.");
    expect(unsavedMessage(3)).toBe("3 rows have changes you haven't saved.");
  });
});
