import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { upstreamRefresh } from '@/lib/auth/upstream-refresh';

const REFRESH_COOKIE = 'slimshot_refresh';

export async function POST() {
  const store = await cookies();
  const token = store.get(REFRESH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_SESSION', message: 'No session.', traceId: 'none' } },
      { status: 401 },
    );
  }

  const result = await upstreamRefresh(token);

  if (!result.ok || !result.data) {
    // The server revokes the whole family on reuse detection, and any other
    // failure (network error, unreadable response, expired token) leaves the
    // cookie unusable either way. Drop it so the next request does not retry
    // a token that is already burned or was never going to work.
    store.delete(REFRESH_COOKIE);
    return NextResponse.json(
      { success: false, error: { code: 'NETWORK', message: 'The refresh failed.', traceId: 'none' } },
      { status: result.status >= 400 ? result.status : 401 },
    );
  }

  store.set(REFRESH_COOKIE, result.data.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json(
    { success: true, data: { accessToken: result.data.accessToken, expiresIn: result.data.expiresIn } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
