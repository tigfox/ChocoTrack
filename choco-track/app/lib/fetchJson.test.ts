import { fetchJson, NETWORK_MESSAGE } from './fetchJson';

const reply = (body: unknown, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('fetchJson', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns parsed JSON on success', async () => {
    fetchMock.mockResolvedValue(reply({ a: 1 }));
    await expect(fetchJson('/x')).resolves.toEqual({ ok: true, data: { a: 1 } });
  });
  it('posts a JSON body', async () => {
    fetchMock.mockResolvedValue(reply({}));
    await fetchJson('/x', { a: 1 });
    expect(fetchMock).toHaveBeenCalledWith('/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
    });
  });
  it('uses GET without a body', async () => {
    fetchMock.mockResolvedValue(reply({}));
    await fetchJson('/x');
    expect(fetchMock).toHaveBeenCalledWith('/x', { method: 'GET' });
  });
  it('reports a dropped connection instead of throwing', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchJson('/x', {})).resolves.toEqual({ ok: false, message: NETWORK_MESSAGE });
  });
  it.each([[401], [403]])('asks for a reload when the session is rejected (%i)', async (status) => {
    fetchMock.mockResolvedValue(reply('', status));
    const r = await fetchJson('/x', {});
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.message).toMatch(/reload/i);
  });
  it('reports other HTTP failures and unreadable bodies', async () => {
    fetchMock.mockResolvedValueOnce(reply('oops', 500));
    expect(await fetchJson('/x')).toMatchObject({ ok: false, message: expect.stringContaining('500') });
    fetchMock.mockResolvedValueOnce(reply('<html>not json</html>'));
    expect(await fetchJson('/x')).toMatchObject({ ok: false, message: expect.stringContaining('unexpected') });
  });
});
