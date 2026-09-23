import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getAccessToken, setAccessToken } from '@/lib/api/client';
import { login, logout, withRefresh } from './session';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function unauthorized() {
  return new ApiError(
    { code: 'UNAUTHORIZED', message: 'Unauthorized', traceId: 't' },
    401,
  );
}

describe('withRefresh', () => {
  it('returns the result when the call succeeds', async () => {
    await expect(withRefresh(async () => 'ok')).resolves.toBe('ok');
  });

  it('refreshes once and retries when the call 401s', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ success: true, data: { accessToken: 'new-tok' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    let calls = 0;
    const result = await withRefresh(async () => {
      calls += 1;
      if (calls === 1) throw unauthorized();
      return 'recovered';
    });

    expect(result).toBe('recovered');
    expect(calls).toBe(2);
  });

  it('does NOT retry more than once, so a persistent 401 cannot loop forever', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ success: true, data: { accessToken: 'new-tok' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    let calls = 0;
    await expect(
      withRefresh(async () => {
        calls += 1;
        throw unauthorized();
      }),
    ).rejects.toBeInstanceOf(ApiError);

    // One original attempt plus exactly one retry. An unbounded loop here
    // would hammer the API and hang the UI.
    expect(calls).toBe(2);
  });

  it('gives up without retrying when the refresh itself 401s', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ success: false }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    let calls = 0;
    await expect(
      withRefresh(async () => {
        calls += 1;
        throw unauthorized();
      }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(calls).toBe(1);
  });

  it('does not refresh on a non-401 error', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      withRefresh(async () => {
        throw new ApiError({ code: 'CONFLICT', message: 'nope', traceId: 't' }, 409);
      }),
    ).rejects.toMatchObject({ status: 409 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('makes concurrent refreshes single-flight, so two callers 401ing at once do not both burn the same cookie', async () => {
    // The server rotates the refresh token and revokes the old one on every
    // /auth/refresh call. If two withRefresh callers both 401 at once (e.g.
    // two queries firing in parallel after a reload with no access token
    // yet), each firing its own POST /api/auth/refresh presents the same
    // cookie twice — the second call reuses an already-revoked token, which
    // trips the server's reuse-detection and revokes the whole family,
    // logging the user out on essentially every reload.
    const gate = deferred<void>();
    const fetchMock = vi.fn(async () => {
      await gate.promise;
      return new Response(JSON.stringify({ success: true, data: { accessToken: 'new-tok' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    let firstCalls = 0;
    let secondCalls = 0;

    const first = withRefresh(async () => {
      firstCalls += 1;
      if (firstCalls === 1) throw unauthorized();
      return 'first-recovered';
    });
    const second = withRefresh(async () => {
      secondCalls += 1;
      if (secondCalls === 1) throw unauthorized();
      return 'second-recovered';
    });

    // Let both withRefresh calls run far enough to hit refreshAccessToken()
    // before releasing the single in-flight fetch.
    await Promise.resolve();
    await Promise.resolve();
    gate.resolve();

    await expect(first).resolves.toBe('first-recovered');
    await expect(second).resolves.toBe('second-recovered');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('login', () => {
  it('throws an ApiError, not a raw SyntaxError, when /api/auth/login returns an unreadable response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>502 Bad Gateway</html>', { status: 502 })),
    );

    await expect(login('a@b.com', 'password123')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('logout', () => {
  it('clears the in-memory access token and POSTs /api/auth/logout', async () => {
    setAccessToken('some-token');

    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ success: true, data: null }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await logout();

    expect(getAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  });
});
