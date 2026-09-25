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

/**
 * RF3: single-flight is per tab, but the refresh cookie is shared by every
 * tab. Two tabs refreshing at once present the same cookie twice; the
 * server revokes the whole family on reuse (token.service.ts:80-84) and
 * logs the user out. navigator.locks serializes the refresh across tabs, so
 * the waiting tab sends the cookie the first tab's refresh just rotated.
 */
describe('refreshAccessToken across tabs (navigator.locks)', () => {
  /** A FIFO exclusive-lock double shared by every "tab" in the test. */
  function fakeLockManager() {
    let tail: Promise<unknown> = Promise.resolve();
    const held = { value: false };
    const request = vi.fn((_name: string, callback: () => Promise<unknown>) => {
      const run = tail.then(async () => {
        held.value = true;
        try {
          return await callback();
        } finally {
          held.value = false;
        }
      });
      tail = run.catch(() => undefined);
      return run;
    });
    return { request, held };
  }

  function okRefresh(token: string) {
    return new Response(JSON.stringify({ success: true, data: { accessToken: token } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'locks');
    vi.resetModules();
  });

  it("runs the refresh fetch inside the 'slimshot-refresh' lock", async () => {
    const locks = fakeLockManager();
    Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });
    const heldDuringFetch: boolean[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        heldDuringFetch.push(locks.held.value);
        return okRefresh('tok');
      }),
    );

    const { refreshAccessToken } = await import('./session');
    await expect(refreshAccessToken()).resolves.toBe('tok');

    expect(locks.request).toHaveBeenCalledTimes(1);
    expect(locks.request.mock.calls[0][0]).toBe('slimshot-refresh');
    expect(heldDuringFetch).toEqual([true]);
  });

  it('serializes two tabs, so the second refresh starts only after the first finished', async () => {
    const locks = fakeLockManager();
    Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });

    // Each tab is its own module instance (its own in-tab single-flight);
    // only the lock and the cookie (here: fetch) are shared.
    const tabA = await import('./session');
    vi.resetModules();
    const tabB = await import('./session');
    expect(tabB.refreshAccessToken).not.toBe(tabA.refreshAccessToken);

    const gateA = deferred<void>();
    let active = 0;
    let maxActive = 0;
    const order: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const n = order.length === 0 ? 'A' : 'B';
        order.push(`${n}:start`);
        active += 1;
        maxActive = Math.max(maxActive, active);
        if (n === 'A') await gateA.promise;
        active -= 1;
        order.push(`${n}:end`);
        return okRefresh(`tok-${n}`);
      }),
    );

    const a = tabA.refreshAccessToken();
    const b = tabB.refreshAccessToken();
    await Promise.resolve();
    await Promise.resolve();
    gateA.resolve();

    await expect(a).resolves.toBe('tok-A');
    await expect(b).resolves.toBe('tok-B');
    expect(maxActive).toBe(1);
    expect(order).toEqual(['A:start', 'A:end', 'B:start', 'B:end']);
  });

  it('still refreshes when navigator.locks is unavailable', async () => {
    expect('locks' in navigator).toBe(false);
    const fetchMock = vi.fn(async () => okRefresh('tok'));
    vi.stubGlobal('fetch', fetchMock);

    const { refreshAccessToken } = await import('./session');
    await expect(refreshAccessToken()).resolves.toBe('tok');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', { method: 'POST' });
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
