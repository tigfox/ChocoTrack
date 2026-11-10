import { assertNoUserErrors, friendlyMessage, ShopifyApiError, ShopifyUserErrors, STALE_STOCK_MESSAGE } from './errors';

describe('assertNoUserErrors', () => {
  it('passes for empty, null and undefined', () => {
    expect(() => assertNoUserErrors('x', [])).not.toThrow();
    expect(() => assertNoUserErrors('x', null)).not.toThrow();
    expect(() => assertNoUserErrors('x', undefined)).not.toThrow();
  });
  it('throws ShopifyUserErrors with the label and messages', () => {
    expect(() => assertNoUserErrors('Adjust', [{ message: 'bad' }, { message: 'worse' }])).toThrow('Adjust: bad; worse');
  });
});

describe('friendlyMessage', () => {
  it('explains stale stock', () => {
    const err = new ShopifyUserErrors('Adjust', [{ message: 'no match', code: 'CHANGE_FROM_QUANTITY_STALE' }]);
    expect(err.isStale).toBe(true);
    expect(friendlyMessage(err)).toBe(STALE_STOCK_MESSAGE);
  });
  it('passes through other Shopify messages', () => {
    const err = new ShopifyUserErrors('Adjust', [{ message: 'Item not tracked' }]);
    expect(err.isStale).toBe(false);
    expect(friendlyMessage(err)).toBe('Item not tracked');
  });
  it('hides request-level details', () => {
    expect(friendlyMessage(new ShopifyApiError('Throttled: token abc'))).not.toContain('abc');
  });
  it('has a generic fallback', () => {
    expect(friendlyMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });
});
