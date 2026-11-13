import { moveItem } from './listOps';

describe('moveItem', () => {
  const list = Object.freeze(['a', 'b', 'c']);
  it('moves an item up or down without changing the original', () => {
    expect(moveItem(list, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(list, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(list).toEqual(['a', 'b', 'c']);
  });
  it('leaves the list alone at the ends or for a bad index', () => {
    expect(moveItem(list, 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(list, 2, 1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(list, 9, 1)).toEqual(['a', 'b', 'c']);
  });
});
