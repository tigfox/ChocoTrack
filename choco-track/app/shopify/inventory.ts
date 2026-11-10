import type { InventoryChange, StockMap } from '../domain/types';
import type { GraphqlClient } from './client';
import { assertNoUserErrors, ShopifyApiError, type UserError } from './errors';

const STOCK_BATCH = 100;

const STOCK_QUERY = `#graphql
  query Stock($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        inventoryItem {
          inventoryLevels(first: 50) {
            nodes { location { id } quantities(names: ["available"]) { quantity } }
          }
        }
      }
    }
  }
`;

interface StockNode {
  readonly id: string;
  readonly inventoryItem: {
    readonly inventoryLevels: {
      readonly nodes: ReadonlyArray<{
        readonly location: { readonly id: string };
        readonly quantities: ReadonlyArray<{ readonly quantity: number }>;
      }>;
    };
  };
}

const chunk = <T>(items: readonly T[], size: number): readonly (readonly T[])[] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

/** Available quantity per variant per location. A location with no level means "not stocked there". */
export const loadStock = async (client: GraphqlClient, variantIds: readonly string[]): Promise<StockMap> => {
  const pages = await Promise.all(
    chunk(variantIds, STOCK_BATCH).map((ids) =>
      client<{ nodes: ReadonlyArray<StockNode | null> }>(STOCK_QUERY, { ids }),
    ),
  );
  return Object.fromEntries(
    pages
      .flatMap((p) => p.nodes)
      .filter((n): n is StockNode => n !== null && n.id !== undefined)
      .map((n) => [
        n.id,
        Object.fromEntries(
          n.inventoryItem.inventoryLevels.nodes.map((l) => [l.location.id, l.quantities[0]?.quantity ?? 0]),
        ),
      ]),
  );
};

const ACTIVATE_MUTATION = `#graphql
  mutation Activate($inventoryItemId: ID!, $locationId: ID!) {
    inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId) {
      inventoryLevel { id }
      userErrors { field message }
    }
  }
`;

/** Stocks an item at a location (at 0) so it can be adjusted. */
export const activateInventory = async (
  client: GraphqlClient,
  inventoryItemId: string,
  locationId: string,
): Promise<void> => {
  const data = await client<{ inventoryActivate: { userErrors: readonly UserError[] } }>(ACTIVATE_MUTATION, {
    inventoryItemId,
    locationId,
  });
  assertNoUserErrors('Activate inventory', data.inventoryActivate.userErrors);
};

const ADJUST_MUTATION = `#graphql
  mutation Adjust($input: InventoryAdjustQuantitiesInput!, $key: String!) {
    inventoryAdjustQuantities(input: $input) @idempotent(key: $key) {
      inventoryAdjustmentGroup { id }
      userErrors { field message code }
    }
  }
`;

export interface AdjustRequest {
  readonly changes: readonly InventoryChange[];
  /** variantId -> inventoryItemId */
  readonly inventoryItemIds: Readonly<Record<string, string>>;
  /** Stock the user saw; each line is guarded with it (changeFromQuantity). */
  readonly stock: StockMap;
  readonly reason: string;
  readonly referenceDocumentUri: string;
  /** One key per submit, so a retry or double-click cannot apply twice. */
  readonly idempotencyKey: string;
}

export class NotStockedError extends Error {
  constructor(readonly variantId: string, readonly locationId: string) {
    super(`Variant ${variantId} is not stocked at ${locationId}`);
    this.name = 'NotStockedError';
  }
}

/** Every line applies or none does. Throws ShopifyUserErrors (isStale when stock moved). */
export const adjustInventory = async (client: GraphqlClient, req: AdjustRequest): Promise<string> => {
  const changes = req.changes.map(({ variantId, locationId, delta }) => {
    const inventoryItemId = req.inventoryItemIds[variantId];
    const changeFromQuantity = req.stock[variantId]?.[locationId];
    if (inventoryItemId === undefined || changeFromQuantity === undefined) throw new NotStockedError(variantId, locationId);
    return { inventoryItemId, locationId, delta, changeFromQuantity };
  });
  const data = await client<{
    inventoryAdjustQuantities: { inventoryAdjustmentGroup: { id: string } | null; userErrors: readonly UserError[] };
  }>(ADJUST_MUTATION, {
    key: req.idempotencyKey,
    input: { name: 'available', reason: req.reason, referenceDocumentUri: req.referenceDocumentUri, changes },
  });
  assertNoUserErrors('Adjust inventory', data.inventoryAdjustQuantities.userErrors);
  const id = data.inventoryAdjustQuantities.inventoryAdjustmentGroup?.id;
  if (!id) throw new ShopifyApiError('Shopify did not return an adjustment record');
  return id;
};

/** Activates (at 0) every change target that has no level yet, returning the stock to guard with. */
export const ensureStocked = async (
  client: GraphqlClient,
  changes: readonly InventoryChange[],
  inventoryItemIds: Readonly<Record<string, string>>,
  stock: StockMap,
): Promise<StockMap> => {
  const missing = changes.filter((c) => stock[c.variantId]?.[c.locationId] === undefined);
  await Promise.all(
    missing.map((c) => {
      const itemId = inventoryItemIds[c.variantId];
      if (itemId === undefined) throw new NotStockedError(c.variantId, c.locationId);
      return activateInventory(client, itemId, c.locationId);
    }),
  );
  return missing.reduce<StockMap>(
    (acc, c) => ({ ...acc, [c.variantId]: { ...acc[c.variantId], [c.locationId]: 0 } }),
    stock,
  );
};
