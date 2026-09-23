import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { API_BASE } from '@/lib/api/client';

const REFRESH_COOKIE = 'slimshot_refresh';

interface RefreshPayload {
  success: boolean;
  data?: { accessToken: string; refreshToken: string; expiresIn: number };
}

export async function POST() {
  const store = await cookies();
  const token = store.get(REFRESH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_SESSION', message: 'No session.', traceId: 'none' } },
      { status: 401 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
  } catch {
    // The API is unreachable. Drop the cookie regardless — a refresh that
    // cannot even reach the server must not leave a stale token behind for
    // the next attempt to retry against a network that is still down.
    store.delete(REFRESH_COOKIE);
    return NextResponse.json(
      { success: false, error: { code: 'NETWORK', message: 'The server could not be reached.', traceId: 'none' } },
      { status: 502 },
    );
  }

  let payload: RefreshPayload;
  try {
    payload = (await res.json()) as RefreshPayload;
  } catch {
    // Non-JSON upstream response (e.g. a proxy 502 HTML page). The refresh
    // token goes uncertain on any failed refresh, so the cookie is dropped
    // here too.
    store.delete(REFRESH_COOKIE);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'NETWORK', message: 'The server returned an unreadable response.', traceId: 'none' },
      },
      { status: res.status || 502 },
    );
  }

  if (!res.ok || !payload.success || !payload.data) {
    // The server revokes the whole family on reuse detection. Drop the cookie
    // so the next request does not retry a token that is already burned.
    store.delete(REFRESH_COOKIE);
    return NextResponse.json(payload, { status: 401 });
  }

  store.set(REFRESH_COOKIE, payload.data.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json(
    { success: true, data: { accessToken: payload.data.accessToken, expiresIn: payload.data.expiresIn } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
