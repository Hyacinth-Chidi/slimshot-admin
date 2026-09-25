// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { getRedirectUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { REFRESH_COOKIE } from '@/lib/auth/cookie';
import { config, proxy } from './proxy';

function request(path: string, withSession: boolean) {
  return new NextRequest(`http://localhost:3001${path}`, {
    headers: withSession ? { cookie: `${REFRESH_COOKIE}=refresh-token` } : {},
  });
}

describe('proxy', () => {
  it('redirects a dashboard page to /login without the session cookie', () => {
    const res = proxy(request('/assets', false));
    expect(getRedirectUrl(res)).toBe('http://localhost:3001/login');
  });

  it('redirects /login to / when the session cookie is present', () => {
    const res = proxy(request('/login', true));
    expect(getRedirectUrl(res)).toBe('http://localhost:3001/');
  });

  it('lets a dashboard page through with the session cookie', () => {
    const res = proxy(request('/assets', true));
    expect(getRedirectUrl(res)).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('lets /login through without the session cookie', () => {
    const res = proxy(request('/login', false));
    expect(getRedirectUrl(res)).toBeNull();
  });
});

describe('proxy matcher', () => {
  it.each(['/', '/assets', '/settings', '/login'])('runs on page %s', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  // The auth route handlers must be reachable without a session (login,
  // refresh) — a redirect there would make logging in impossible.
  it.each(['/api/auth/login', '/api/auth/refresh', '/api/auth/logout', '/_next/static/chunk.js', '/favicon.ico'])(
    'leaves %s alone',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    },
  );
});
