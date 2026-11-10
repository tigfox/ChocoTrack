export interface UserError {
  readonly field?: readonly string[] | null;
  readonly message: string;
  readonly code?: string | null;
}

/** The request itself failed (network, auth, throttling, malformed query). */
export class ShopifyApiError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = 'ShopifyApiError';
  }
}

/** Shopify accepted the request but rejected the change (a `userErrors` response). */
export class ShopifyUserErrors extends Error {
  constructor(readonly label: string, readonly errors: readonly UserError[]) {
    super(`${label}: ${errors.map((e) => e.message).join('; ')}`);
    this.name = 'ShopifyUserErrors';
  }
  get isStale(): boolean {
    return this.errors.some((e) => e.code === 'CHANGE_FROM_QUANTITY_STALE');
  }
}

export const assertNoUserErrors = (label: string, errors: readonly UserError[] | null | undefined): void => {
  if (errors && errors.length > 0) throw new ShopifyUserErrors(label, errors);
};

export const STALE_STOCK_MESSAGE =
  "Stock changed while you were reviewing (for example, another sale). We've refreshed the quantities - please check and submit again.";

/** A message safe to show in the admin UI. */
export const friendlyMessage = (err: unknown): string => {
  if (err instanceof ShopifyUserErrors) {
    return err.isStale ? STALE_STOCK_MESSAGE : err.errors.map((e) => e.message).join(' ');
  }
  if (err instanceof ShopifyApiError) return 'Shopify could not be reached or rejected the request. Please try again.';
  return 'Something went wrong. Please try again.';
};
