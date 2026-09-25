// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE } from '@/lib/api/client';
import { upstreamRefresh } from './upstream-refresh';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('upstreamRefresh', () => {
  it('POSTs the refresh token to the API and returns the rotated pair', async () => {
    const data = { accessToken: 'a2', refreshToken: 'r2', expiresIn: 900 };
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => jsonResponse({ success: true, data }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(upstreamRefresh('r1')).resolves.toEqual({ ok: true, status: 200, data });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/auth/refresh`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init!.body as string)).toEqual({ refreshToken: 'r1' });
  });

  it('normalises an upstream 401 to ok: false with its status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ success: false, error: { code: 'UNAUTHENTICATED', message: 'x', traceId: 't' } }, 401),
      ),
    );
    await expect(upstreamRefresh('r1')).resolves.toEqual({ ok: false, status: 401 });
  });

  it('treats a 200 with an unsuccessful envelope as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ success: false })));
    await expect(upstreamRefresh('r1')).resolves.toMatchObject({ ok: false });
  });

  it('normalises a non-JSON response to ok: false rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })));
    await expect(upstreamRefresh('r1')).resolves.toEqual({ ok: false, status: 502 });
  });

  it('normalises a network failure to ok: false, status 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    await expect(upstreamRefresh('r1')).resolves.toEqual({ ok: false, status: 502 });
  });
});
