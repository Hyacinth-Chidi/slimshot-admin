import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from '@/lib/api/client';
import {
  adjustCredits,
  deleteUser,
  fetchUser,
  fetchUserLedger,
  searchUsers,
  suspendUser,
  unsuspendUser,
} from './users';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/lib/auth/session', () => ({ withRefresh: (fn: () => unknown) => fn() }));

afterEach(() => {
  vi.resetAllMocks();
});

describe('users API', () => {
  it('searches with only the params given, encoding the term', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ items: [], nextCursor: null });
    await searchUsers({ q: 'ann lee&co', limit: 20 });
    expect(client.apiFetch).toHaveBeenCalledWith('/users?q=ann+lee%26co&limit=20');
  });

  it('lists everyone when no params are given', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ items: [], nextCursor: null });
    await searchUsers({});
    expect(client.apiFetch).toHaveBeenCalledWith('/users');
  });

  it('encodes the id when fetching one user', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({});
    await fetchUser('a/b');
    expect(client.apiFetch).toHaveBeenCalledWith('/users/a%2Fb');
  });

  it("pages a user's ledger by cursor", async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ items: [], nextCursor: null });
    await fetchUserLedger('u1', { cursor: 'c1' });
    expect(client.apiFetch).toHaveBeenCalledWith('/users/u1/ledger?cursor=c1');
  });

  it('posts a signed adjustment with its reason', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ balance: 80 });
    await adjustCredits('u1', -20, 'Chargeback');
    expect(client.apiFetch).toHaveBeenCalledWith('/users/u1/adjustments', {
      method: 'POST',
      body: JSON.stringify({ amount: -20, reason: 'Chargeback' }),
    });
  });

  it('suspends with a reason and unsuspends with no body', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({});
    await suspendUser('u1', 'Ad abuse');
    expect(client.apiFetch).toHaveBeenCalledWith('/users/u1/suspend', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Ad abuse' }),
    });
    await unsuspendUser('u1');
    expect(client.apiFetch).toHaveBeenLastCalledWith('/users/u1/unsuspend', { method: 'POST' });
  });

  it('deletes with DELETE and the reason in the body', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ deleted: true });
    await deleteUser('u1', 'Asked by email');
    expect(client.apiFetch).toHaveBeenCalledWith('/users/u1', {
      method: 'DELETE',
      body: JSON.stringify({ reason: 'Asked by email' }),
    });
  });
});
