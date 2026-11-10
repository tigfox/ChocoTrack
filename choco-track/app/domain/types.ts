export type KitSize = 4 | 5 | 6 | 12;

export interface Location {
  readonly id: string;
  readonly name: string;
}

export interface Collection {
  readonly id: string;
  readonly title: string;
}

export interface Variant {
  readonly id: string;
  readonly title: string;
  readonly sku: string;
  readonly barcode: string;
  readonly collectionIds: readonly string[];
  /** Product image (a Shopify image URL in the real app). */
  readonly imageUrl?: string;
  /** Present only on sellable kit variants. */
  readonly kitSize?: KitSize;
}

/** variantId -> locationId -> available quantity. A missing location means "not stocked there". */
export type StockMap = Readonly<Record<string, Readonly<Record<string, number>>>>;

/** variantId -> number of units. */
export type UnitCounts = Readonly<Record<string, number>>;

export interface InventoryChange {
  readonly variantId: string;
  readonly locationId: string;
  readonly delta: number;
}

export type IssueCode =
  | 'NO_LOCATION'
  | 'NO_KIT'
  | 'KIT_AS_COMPONENT'
  | 'BAD_KIT_COUNT'
  | 'NO_UNITS'
  | 'WRONG_UNIT_TOTAL'
  | 'NOT_STOCKED'
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_QUANTITY';

export interface ValidationIssue {
  readonly code: IssueCode;
  readonly message: string;
  readonly variantId?: string;
}

export const isKit = (v: Variant): v is Variant & { kitSize: KitSize } => v.kitSize !== undefined;
