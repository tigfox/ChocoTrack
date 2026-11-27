interface ShopifyGlobal {
  readonly toast?: { readonly show?: (message: string) => void };
}

/** A short message at the bottom of the admin (App Bridge). Does nothing where App Bridge is absent, such as tests. */
export const showToast = (message: string): void => {
  const shopify = (globalThis as { shopify?: ShopifyGlobal }).shopify;
  shopify?.toast?.show?.(message);
};
