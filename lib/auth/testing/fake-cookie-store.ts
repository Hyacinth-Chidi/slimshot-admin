import type { cookies } from 'next/headers';

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export interface SetCall {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

/**
 * Test double for `next/headers`' cookie store: records every set/delete so
 * a route handler test can assert what the browser would end up holding.
 * Test-only; imported by the auth route and proxy tests.
 */
export function fakeCookieStore(initial: Record<string, string> = {}) {
  const jar = new Map<string, string>(Object.entries(initial));
  const sets: SetCall[] = [];
  const deletes: string[] = [];

  const store = {
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    has: (name: string) => jar.has(name),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      jar.set(name, value);
      sets.push({ name, value, options });
    },
    delete: (name: string) => {
      jar.delete(name);
      deletes.push(name);
    },
  };

  return { jar, sets, deletes, store: store as unknown as CookieStore };
}
