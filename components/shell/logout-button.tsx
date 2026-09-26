'use client';

import { logout } from '@/lib/auth/session';

/**
 * The one place that knows how to log out: clear local state via
 * lib/auth/session's logout(), then a full navigation to /login so no
 * in-memory state (access token, query cache) survives into the next
 * session. The sidebar and the phone top bar call this rather than each
 * calling logout() themselves.
 */
export async function performLogout(): Promise<void> {
  await logout();
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full navigation is intentional: it drops the in-memory token and query cache.
  window.location.assign('/login');
}
