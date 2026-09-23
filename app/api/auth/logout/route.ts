import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { API_BASE } from '@/lib/api/client';

const REFRESH_COOKIE = 'slimshot_refresh';

export async function POST(request: Request) {
  const store = await cookies();
  const token = store.get(REFRESH_COOKIE)?.value;

  // The server's POST /auth/logout is guarded by JwtAuthGuard: it requires a
  // valid Bearer access token AND { refreshToken } in the body (see
  // slimshot_server/src/modules/auth/auth.controller.ts:29-34, which stacks
  // @UseGuards(JwtAuthGuard) over a RefreshDto body). The access token lives
  // only in the browser's in-memory client state, never on the server, so it
  // has to be forwarded from the incoming request's Authorization header.
  const authHeader = request.headers.get('authorization');

  if (token && authHeader) {
    // Best effort: the cookie is cleared regardless, so a failing API call
    // cannot strand the browser in a logged-in-looking state.
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: authHeader,
      },
      body: JSON.stringify({ refreshToken: token }),
    }).catch(() => undefined);
  }

  store.delete(REFRESH_COOKIE);
  return NextResponse.json({ success: true, data: null });
}
