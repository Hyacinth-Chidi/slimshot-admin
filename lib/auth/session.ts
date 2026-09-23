import { ApiError, apiFetch, setAccessToken } from '@/lib/api/client';

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
}

export async function login(email: string, password: string): Promise<AdminProfile> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  let body:
    | { success: true; data: { accessToken: string } }
    | { success: false; error: { code: string; message: string; traceId: string } };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // An unreachable API or a proxy error in front of it can still slip
    // through as a non-JSON response. Surface a typed ApiError rather than
    // letting a raw SyntaxError from res.json() escape to the caller.
    throw new ApiError(
      { code: 'NETWORK', message: 'The server returned an unreadable response.', traceId: 'none' },
      res.status || 502,
    );
  }

  if (!body.success) throw new ApiError(body.error, res.status);

  setAccessToken(body.data.accessToken);
  return apiFetch<AdminProfile>('/auth/me');
}

export async function logout(): Promise<void> {
  // The route handler rotates the refresh token itself to mint a fresh
  // access token server-side before calling the API's logout, so this does
  // not need to forward anything — it just clears local state and tells the
  // route handler to do the rest.
  setAccessToken(null);
  await fetch('/api/auth/logout', { method: 'POST' });
}

// The server rotates the refresh token and revokes the old one on every call
// to /auth/refresh, and revokes the whole family if a revoked token is
// presented again (reuse detection). Two callers 401ing at once — e.g. two
// queries firing in parallel right after a reload, before any access token
// exists — would otherwise each POST /api/auth/refresh with the same cookie:
// the second call presents a token the first call already burned, trips
// reuse detection, and gets the whole session logged out. Coalescing
// concurrent calls into a single in-flight fetch keeps that from happening.
let inflight: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!res.ok) return null;

    const body = (await res.json()) as
      | { success: true; data: { accessToken: string } }
      | { success: false };

    if (!body.success) return null;
    setAccessToken(body.data.accessToken);
    return body.data.accessToken;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/**
 * Runs `fn`, and on a 401 refreshes the access token and retries EXACTLY once.
 *
 * The retry is capped deliberately. An unbounded refresh-on-401 loop is the
 * classic form of this bug: the token is genuinely invalid, every retry 401s,
 * and the UI hangs while the API is hammered.
 */
export async function withRefresh<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;

    const token = await refreshAccessToken();
    if (!token) throw err;

    return fn();
  }
}
