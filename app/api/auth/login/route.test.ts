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

function loginRequest() {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.com', password: 'correct horse' }),
  });
}

let fake: ReturnType<typeof fakeCookieStore>;

beforeEach(() => {
  fake = fakeCookieStore();
  vi.mocked(cookies).mockResolvedValue(fake.store);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/auth/login', () => {
  it('puts the refresh token in an httpOnly cookie and never returns it in the body', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        success: true,
        data: { accessToken: 'access-1', refreshToken: 'refresh-SECRET', expiresIn: 900 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST(loginRequest());
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(JSON.parse(text)).toEqual({ success: true, data: { accessToken: 'access-1', expiresIn: 900 } });
    // Not under any key, not anywhere in the body.
    expect(text).not.toContain('refresh-SECRET');
    expect(text).not.toContain('refreshToken');
    expect(res.headers.get('cache-control')).toBe('no-store');

    expect(fake.sets).toHaveLength(1);
    expect(fake.sets[0]).toMatchObject({
      name: REFRESH_COOKIE,
      value: 'refresh-SECRET',
      options: { httpOnly: true, sameSite: 'lax', path: '/' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/auth/login`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('passes an upstream rejection through and sets no cookie', async () => {
    const envelope = {
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Invalid email or password.', traceId: 't' },
    };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(envelope, 401)));

    const res = await POST(loginRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(envelope);
    expect(fake.sets).toEqual([]);
  });

  it('returns a typed 502 and sets no cookie when the API is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    const res = await POST(loginRequest());

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'NETWORK' } });
    expect(fake.sets).toEqual([]);
  });

  it('returns a typed error and sets no cookie when the API answers with non-JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })));

    const res = await POST(loginRequest());

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'NETWORK' } });
    expect(fake.sets).toEqual([]);
  });
});
