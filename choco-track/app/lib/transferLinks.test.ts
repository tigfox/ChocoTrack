import { shopHandle, transferListUrl, transferUrl } from './transferLinks';

describe('shopHandle', () => {
  it('takes the store name off a myshopify domain', () => {
    expect(shopHandle('choco-dev.myshopify.com')).toBe('choco-dev');
  });
  it('rejects anything that is not a plain myshopify domain', () => {
    for (const s of ['', 'example.com', 'a.b.myshopify.com', '../x.myshopify.com', 'UP per.myshopify.com', undefined]) {
      expect(shopHandle(s)).toBeUndefined();
    }
  });
});

describe('transferUrl', () => {
  it('builds the admin page for a transfer', () => {
    expect(transferUrl('choco-dev', 'gid://shopify/InventoryTransfer/123')).toBe('https://admin.shopify.com/store/choco-dev/transfers/123');
  });
  it('returns nothing for an unusable id or handle', () => {
    expect(transferUrl('choco-dev', 'gid://shopify/Location/123')).toBeUndefined();
    expect(transferUrl('choco-dev', 'gid://shopify/InventoryTransfer/abc')).toBeUndefined();
    expect(transferUrl(undefined, 'gid://shopify/InventoryTransfer/123')).toBeUndefined();
  });
});

describe('transferListUrl', () => {
  it('links to the Transfers list', () => {
    expect(transferListUrl('choco-dev')).toBe('https://admin.shopify.com/store/choco-dev/transfers');
    expect(transferListUrl(undefined)).toBeUndefined();
  });
});
