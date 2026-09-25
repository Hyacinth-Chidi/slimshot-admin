import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { API_BASE } from '@/lib/api/client';
import { upstreamRefresh } from '@/lib/auth/upstream-refresh';
import { REFRESH_COOKIE } from '@/lib/auth/cookie';

export async function POST() {
  const store = await cookies();
  const token = store.get(REFRESH_COOKIE)?.value;

  if (token) {
    // The server's POST /auth/logout is guarded by JwtAuthGuard, which
    // requires a valid Bearer access token (see
    // slimshot_server/src/modules/auth/auth.controller.ts:29-34 and
    // jwt-auth.guard.ts:23-28). The browser's in-memory access token is
    // short-lived (15 min) and may already be gone (e.g. right after a
    // reload), so it can't be relied on. Rotate the refresh token first to
    // mint a fresh access token server-side, then use that to authorize the
    // logout call. This also means logout no longer depends on the caller
    // forwarding an Authorization header.
    const rotated = await upstreamRefresh(token);

    if (rotated.ok && rotated.data) {
      // Best effort: the cookie is cleared regardless, so a failing API call
      // cannot strand the browser in a logged-in-looking state.
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${rotated.data.accessToken}`,
        },
        body: JSON.stringify({ refreshToken: rotated.data.refreshToken }),
      }).catch(() => undefined);
    }
    // If rotation itself failed, the refresh token was already invalid,
    // expired, or the family already revoked server-side — there is nothing
    // further to revoke, so it's safe to just drop the cookie below.
  }

  store.delete(REFRESH_COOKIE);
  return NextResponse.json({ success: true, data: null });
}
