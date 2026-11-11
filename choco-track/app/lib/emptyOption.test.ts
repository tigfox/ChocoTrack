import { fromOptionValue, toOptionValue } from './emptyOption';

describe('emptyOption', () => {
  it('gives the empty choice a real value, because s-select reports an empty option by its label', () => {
    expect(toOptionValue('')).toBe('none');
    expect(toOptionValue('gid://shopify/Collection/1')).toBe('gid://shopify/Collection/1');
  });
  it('maps it back to empty', () => {
    expect(fromOptionValue('none')).toBe('');
    expect(fromOptionValue('gid://shopify/Collection/1')).toBe('gid://shopify/Collection/1');
  });
});
