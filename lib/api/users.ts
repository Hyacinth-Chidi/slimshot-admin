import { apiFetch } from './client';
import { withRefresh } from '@/lib/auth/session';

/**
 * Wraps the server's app-user routes
 * (../slimshot_server/docs/admin-credits-api.md §4). These are people signed
 * in to the mobile app, not dashboard admins. Paged routes return
 * `{ items, nextCursor }` inside `data`, so plain apiFetch keeps the cursor.
 */
export type UserStatus = 'active' | 'suspended' | 'deleted';

export interface UserSummary {
  id: string;
  email: string | null;
  username: string | null;
  accountStatus: UserStatus;
  creditBalance: number;
  createdAt: string;
  claimedAt: string | null;
}

export interface UserDetail extends UserSummary {
  referralCode: string | null;
  deletedAt: string | null;
  signInMethods: { google: boolean; email: boolean };
}

export interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

const userPath = (id: string) => `/users/${encodeURIComponent(id)}`;

export function searchUsers(p: { q?: string; cursor?: string; limit?: number }): Promise<Page<UserSummary>> {
  return withRefresh(() => apiFetch<Page<UserSummary>>(withQuery('/users', p)));
}

export function fetchUser(id: string): Promise<UserDetail> {
  return withRefresh(() => apiFetch<UserDetail>(userPath(id)));
}

export function fetchUserLedger(id: string, p: { cursor?: string; limit?: number }): Promise<Page<LedgerEntry>> {
  return withRefresh(() => apiFetch<Page<LedgerEntry>>(withQuery(`${userPath(id)}/ledger`, p)));
}

export function adjustCredits(id: string, amount: number, reason: string): Promise<{ balance: number }> {
  return withRefresh(() =>
    apiFetch<{ balance: number }>(`${userPath(id)}/adjustments`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    }),
  );
}

export function suspendUser(id: string, reason: string): Promise<UserDetail> {
  return withRefresh(() =>
    apiFetch<UserDetail>(`${userPath(id)}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  );
}

export function unsuspendUser(id: string): Promise<UserDetail> {
  return withRefresh(() => apiFetch<UserDetail>(`${userPath(id)}/unsuspend`, { method: 'POST' }));
}

export function deleteUser(id: string, reason: string): Promise<{ deleted: true }> {
  return withRefresh(() =>
    apiFetch<{ deleted: true }>(userPath(id), { method: 'DELETE', body: JSON.stringify({ reason }) }),
  );
}
