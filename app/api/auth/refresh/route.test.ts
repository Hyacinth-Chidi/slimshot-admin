// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

let fake: ReturnType<typeof fakeCookieStore>;

function withSession() {
  fake = fakeCookieStore({ [REFRESH_COOKIE]: 'refresh-OLD' });
  vi.mocked(cookies).mockResolvedValue(fake.store);
}

beforeEach(() => {
  fake = fakeCookieStore();
  vi.mocked(cookies).mockResolvedValue(fake.store);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/auth/refresh', () => {
  it('rotates the cookie to the new refresh token and returns only the access token', async () => {
    withSession();
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      jsonResponse({
        success: true,
        data: { accessToken: 'access-NEW', refreshToken: 'refresh-NEW', expiresIn: 900 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST();
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(JSON.parse(text)).toEqual({ success: true, data: { accessToken: 'access-NEW', expiresIn: 900 } });
    expect(text).not.toContain('refresh-NEW');
    expect(res.headers.get('cache-control')).toBe('no-store');

    // Upstream saw the OLD token; the browser now holds the NEW one.
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/auth/refresh`);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ refreshToken: 'refresh-OLD' });
    expect(fake.jar.get(REFRESH_COOKIE)).toBe('refresh-NEW');
    expect(fake.sets[0].options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    expect(fake.deletes).toEqual([]);
  });

  it('answers 401 without calling upstream when there is no cookie', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST();

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes the cookie when upstream rejects the token (401 / reuse detection)', async () => {
    withSession();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { success: false, error: { code: 'UNAUTHENTICATED', message: 'Token reuse detected.', traceId: 't' } },
          401,
        ),
      ),
    );

    const res = await POST();

    expect(res.status).toBe(401);
    expect(fake.deletes).toEqual([REFRESH_COOKIE]);
    expect(fake.jar.has(REFRESH_COOKIE)).toBe(false);
    expect(fake.sets).toEqual([]);
  });

  it('deletes the cookie when upstream answers with non-JSON', async () => {
    withSession();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })));

    const res = await POST();

    expect(res.status).toBe(502);
    expect(fake.jar.has(REFRESH_COOKIE)).toBe(false);
    expect(fake.sets).toEqual([]);
  });

  it('deletes the cookie when the upstream call throws', async () => {
    withSession();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    const res = await POST();

    expect(res.status).toBe(502);
    expect(fake.jar.has(REFRESH_COOKIE)).toBe(false);
    expect(fake.sets).toEqual([]);
  });
});
