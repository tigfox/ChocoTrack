const SHOP_DOMAIN = /^([a-z0-9][a-z0-9-]*)\.myshopify\.com$/;
const TRANSFER_GID = /^gid:\/\/shopify\/InventoryTransfer\/(\d+)$/;

/** The store name from the session's shop domain; anything unexpected gives no links rather than a wrong one. */
export const shopHandle = (shopDomain: string | undefined): string | undefined => SHOP_DOMAIN.exec(shopDomain ?? '')?.[1];

const adminBase = (handle: string): string => `https://admin.shopify.com/store/${handle}`;

export const transferListUrl = (handle: string | undefined): string | undefined => (handle ? `${adminBase(handle)}/transfers` : undefined);

/** The Shopify admin page of one transfer, or nothing when the id is not a transfer id. */
export const transferUrl = (handle: string | undefined, transferGid: string): string | undefined => {
  const id = TRANSFER_GID.exec(transferGid)?.[1];
  return handle && id ? `${adminBase(handle)}/transfers/${id}` : undefined;
};
