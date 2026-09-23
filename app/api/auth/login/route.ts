import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { API_BASE } from '@/lib/api/client';

const REFRESH_COOKIE = 'slimshot_refresh';

interface LoginPayload {
  success: boolean;
  data?: { accessToken: string; refreshToken: string; expiresIn: number };
  error?: unknown;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { email: string; password: string };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // The upstream API is unreachable (e.g. down, DNS failure). Surface a
    // typed error instead of letting the request throw and become an
    // unhandled 500 with no body.
    return NextResponse.json(
      { success: false, error: { code: 'NETWORK', message: 'The server could not be reached.', traceId: 'none' } },
      { status: 502 },
    );
  }

  let payload: LoginPayload;
  try {
    payload = (await res.json()) as LoginPayload;
  } catch {
    // The upstream API is down, or a proxy in front of it returned a non-JSON
    // error page (e.g. a 502). Surface something actionable instead of an
    // unhandled 500 with no body.
    return NextResponse.json(
      {
        success: false,
        error: { code: 'NETWORK', message: 'The server returned an unreadable response.', traceId: 'none' },
      },
      { status: res.status || 502 },
    );
  }

  if (!res.ok || !payload.success || !payload.data) {
    return NextResponse.json(payload, { status: res.status });
  }

  // The refresh token goes into an httpOnly cookie and is never returned to
  // the browser's JavaScript. Only the access token crosses back, and it is
  // held in memory.
  const store = await cookies();
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
