// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cookies } from 'next/headers';
import { API_BASE } from '@/lib/api/client';
import { REFRESH_COOKIE } from '@/lib/auth/cookie';
import { fakeCookieStore } from '@/lib/auth/testing/fake-cookie-store';
import { POST } from './route';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function session(initial: Record<string, string> = { [REFRESH_COOKIE]: 'refresh-OLD' }) {
  const fake = fakeCookieStore(initial);
  vi.mocked(cookies).mockResolvedValue(fake.store);
  return fake;
}

const ROTATED = jsonResponse({
  success: true,
  data: { accessToken: 'access-FRESH', refreshToken: 'refresh-FRESH', expiresIn: 900 },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/auth/logout', () => {
  it('rotates, then calls upstream logout with the fresh bearer and fresh refresh token, then drops the cookie', async () => {
    const fake = session();
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) =>
      String(url).endsWith('/auth/refresh') ? ROTATED.clone() : jsonResponse({ success: true, data: null }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST();

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [refreshUrl, refreshInit] = fetchMock.mock.calls[0];
    expect(refreshUrl).toBe(`${API_BASE}/auth/refresh`);
    expect(JSON.parse(refreshInit!.body as string)).toEqual({ refreshToken: 'refresh-OLD' });

    // The server's /auth/logout needs a valid Bearer (JwtAuthGuard) and
    // revokes the family of the refresh token it is given — the rotated one,
    // since the old one is already spent.
    const [logoutUrl, logoutInit] = fetchMock.mock.calls[1];
    expect(logoutUrl).toBe(`${API_BASE}/auth/logout`);
    expect(new Headers(logoutInit!.headers).get('authorization')).toBe('Bearer access-FRESH');
    expect(JSON.parse(logoutInit!.body as string)).toEqual({ refreshToken: 'refresh-FRESH' });

    expect(fake.jar.has(REFRESH_COOKIE)).toBe(false);
    // The rotated token is never handed to the browser.
    expect(fake.sets).toEqual([]);
  });

  it('still drops the cookie, without calling upstream logout, when rotation fails', async () => {
    const fake = session();
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: false, error: { code: 'UNAUTHENTICATED', message: 'x', traceId: 't' } }, 401),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST();

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fake.jar.has(REFRESH_COOKIE)).toBe(false);
  });

  it('still drops the cookie when the upstream logout call throws', async () => {
    const fake = session();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).endsWith('/auth/refresh')) return ROTATED.clone();
        throw new TypeError('fetch failed');
      }),
    );

    const res = await POST();

    expect(res.status).toBe(200);
    expect(fake.jar.has(REFRESH_COOKIE)).toBe(false);
  });

  it('drops the cookie and calls nothing upstream when there is no session', async () => {
    const fake = session({});
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST();

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fake.deletes).toEqual([REFRESH_COOKIE]);
  });
});
