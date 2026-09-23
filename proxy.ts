import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const REFRESH_COOKIE = 'slimshot_refresh';

/**
 * Next.js 16 renamed `middleware` to `proxy`. This is a convenience guard
 * only: the API rejects unauthorised requests regardless, so this exists to
 * avoid rendering a shell the user cannot populate, not to enforce security.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(REFRESH_COOKIE);
  const isLogin = request.nextUrl.pathname.startsWith('/login');

  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (hasSession && isLogin) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
