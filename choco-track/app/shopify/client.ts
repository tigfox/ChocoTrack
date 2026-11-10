import { ShopifyApiError } from './errors';

/** Runs one Admin GraphQL operation and returns its `data`. Throws ShopifyApiError on request-level errors. */
export type GraphqlClient = <T>(query: string, variables?: Readonly<Record<string, unknown>>) => Promise<T>;

/** The slice of the template's `admin` object we rely on. */
export interface AdminLike {
  graphql(query: string, options?: { variables?: Record<string, unknown> }): Promise<Response>;
}

interface GraphqlBody {
  readonly data?: unknown;
  readonly errors?: ReadonlyArray<{ message: string }>;
}

export const fromAdmin =
  (admin: AdminLike): GraphqlClient =>
  async <T>(query: string, variables?: Readonly<Record<string, unknown>>): Promise<T> => {
    const response = await admin.graphql(query, variables ? { variables: { ...variables } } : undefined);
    const body = (await response.json()) as GraphqlBody;
    if (body.errors && body.errors.length > 0) {
      throw new ShopifyApiError(body.errors.map((e) => e.message).join('; '), body.errors);
    }
    if (body.data === undefined || body.data === null) throw new ShopifyApiError('Shopify returned no data');
    return body.data as T;
  };
