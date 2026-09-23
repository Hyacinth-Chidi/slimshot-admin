import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, setAccessToken } from '@/lib/api/client';
import { withRefresh } from './session';

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
});
