import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, apiFetchEnvelope, getAccessToken, setAccessToken } from './client';

function mockFetch(body: unknown, status = 200) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('unwraps the data envelope', async () => {
    vi.stubGlobal('fetch', mockFetch({ success: true, data: { id: 'a1' } }));
    await expect(apiFetch('/assets')).resolves.toEqual({ id: 'a1' });
  });

  it('throws ApiError carrying code, message and traceId', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Unknown setting: x', traceId: 't-1' },
        },
        404,
      ),
    );

    await expect(apiFetch('/settings/x')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Unknown setting: x',
      traceId: 't-1',
      status: 404,
    });
  });

  it('attaches the access token when one is set', async () => {
    const fetchMock = mockFetch({ success: true, data: null });
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('tok-123');

    await apiFetch('/assets');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok-123');
  });

  it('sends no authorization header when no token is set', async () => {
    const fetchMock = mockFetch({ success: true, data: null });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/assets');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).has('authorization')).toBe(false);
  });

  it('throws a usable ApiError when the body is not JSON at all', async () => {
    // A 502 from a proxy returns HTML, not the API envelope. Blindly calling
    // .json() throws a SyntaxError that tells the user nothing.
    vi.stubGlobal(
      'fetch',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('<html>Bad Gateway</html>', { status: 502 })),
    );

    await expect(apiFetch('/assets')).rejects.toBeInstanceOf(ApiError);
  });

  it('never stores the token anywhere but memory', () => {
    setAccessToken('tok-abc');
    expect(getAccessToken()).toBe('tok-abc');
    // An XSS that can read localStorage must not find a token there.
    expect(JSON.stringify(localStorage)).not.toContain('tok-abc');
    expect(JSON.stringify(sessionStorage)).not.toContain('tok-abc');
  });
});

describe('apiFetchEnvelope', () => {
  it('returns data AND meta, which apiFetch discards', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ success: true, data: [{ id: 'x' }], meta: { nextCursor: 'c1' } }),
    );

    const page = await apiFetchEnvelope<{ id: string }[], { nextCursor: string | null }>('/audit-logs');
    expect(page.data).toEqual([{ id: 'x' }]);
    expect(page.meta.nextCursor).toBe('c1');
  });

  it('still throws ApiError on a failure envelope', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ success: false, error: { code: 'X', message: 'no', traceId: 't' } }, 400),
    );
    await expect(apiFetchEnvelope('/audit-logs')).rejects.toBeInstanceOf(ApiError);
  });
});
