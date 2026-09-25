/**
 * The one definition of the refresh-token cookie, shared by the login,
 * refresh and logout route handlers and by proxy.ts.
 *
 * httpOnly: the refresh token never reaches the browser's JavaScript (only
 * the short-lived access token does, held in memory). sameSite lax + path /
 * so it rides along on same-site navigations the proxy inspects.
 */
export const REFRESH_COOKIE = 'slimshot_refresh';

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: THIRTY_DAYS_SECONDS,
  };
}
