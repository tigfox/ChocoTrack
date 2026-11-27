import { showToast } from './showToast';

describe('showToast', () => {
  afterEach(() => {
    delete (globalThis as { shopify?: unknown }).shopify;
  });
  it('shows the message through App Bridge', () => {
    const show = vi.fn();
    (globalThis as { shopify?: unknown }).shopify = { toast: { show } };
    showToast('Done');
    expect(show).toHaveBeenCalledWith('Done');
  });
  it('does nothing when App Bridge is not there', () => {
    expect(() => showToast('Done')).not.toThrow();
    (globalThis as { shopify?: unknown }).shopify = {};
    expect(() => showToast('Done')).not.toThrow();
  });
});
