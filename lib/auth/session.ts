import { ApiError, apiFetch, getAccessToken, setAccessToken } from '@/lib/api/client';

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
  const body = (await res.json()) as
    | { success: true; data: { accessToken: string } }
    | { success: false; error: { code: string; message: string; traceId: string } };

  if (!body.success) throw new ApiError(body.error, res.status);

  setAccessToken(body.data.accessToken);
  return apiFetch<AdminProfile>('/auth/me');
}

export async function logout(): Promise<void> {
  // The server's logout endpoint requires the Bearer access token (it revokes
  // the specific session), so it must be forwarded to the route handler
  // before the in-memory token is cleared.
  const token = getAccessToken();
  setAccessToken(null);
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}

export async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch('/api/auth/refresh', { method: 'POST' });
  if (!res.ok) return null;

  const body = (await res.json()) as
    | { success: true; data: { accessToken: string } }
    | { success: false };

  if (!body.success) return null;
  setAccessToken(body.data.accessToken);
  return body.data.accessToken;
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
