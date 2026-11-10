import { fromAdmin } from './client';
import { ShopifyApiError } from './errors';

const admin = (body: unknown) => {
  const graphql = vi.fn().mockResolvedValue({ json: async () => body });
  return { graphql };
};

describe('fromAdmin', () => {
  it('returns data and forwards variables', async () => {
    const a = admin({ data: { ok: 1 } });
    await expect(fromAdmin(a)('query', { a: 1 })).resolves.toEqual({ ok: 1 });
    expect(a.graphql).toHaveBeenCalledWith('query', { variables: { a: 1 } });
  });
  it('omits options when there are no variables', async () => {
    const a = admin({ data: {} });
    await fromAdmin(a)('query');
    expect(a.graphql).toHaveBeenCalledWith('query', undefined);
  });
  it('throws ShopifyApiError on GraphQL errors', async () => {
    await expect(fromAdmin(admin({ errors: [{ message: 'Throttled' }] }))('q')).rejects.toThrow(ShopifyApiError);
  });
  it('throws when data is missing', async () => {
    await expect(fromAdmin(admin({}))('q')).rejects.toThrow('no data');
  });
});
