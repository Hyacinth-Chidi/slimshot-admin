import { API_BASE } from '@/lib/api/client';

export interface UpstreamRefreshResult {
  ok: boolean;
  status: number;
  data?: { accessToken: string; refreshToken: string; expiresIn: number };
}

/**
 * Calls the real API's POST /auth/refresh and normalises every failure mode
 * (network error, non-JSON response, unsuccessful envelope) into `ok: false`
 * rather than throwing. Shared by the refresh route handler and the logout
 * route handler, which both need a fresh access token before they can call
 * an endpoint that requires one.
 */
export async function upstreamRefresh(refreshToken: string): Promise<UpstreamRefreshResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return { ok: false, status: 502 };
  }

  let payload: { success: boolean; data?: UpstreamRefreshResult['data'] };
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    return { ok: false, status: res.status || 502 };
  }

  if (!res.ok || !payload.success || !payload.data) {
    return { ok: false, status: res.status || 401 };
  }

  return { ok: true, status: res.status, data: payload.data };
}
