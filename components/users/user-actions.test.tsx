import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { AdminRole } from '@/lib/auth/permissions';
import type { UserDetail, UserStatus } from '@/lib/api/users';
import { UserActions } from './user-actions';

function makeDetail(accountStatus: UserStatus): UserDetail {
  return {
    id: 'u1',
    email: 'ann@example.com',
    username: 'ann',
    accountStatus,
    creditBalance: 120,
    createdAt: '2026-10-01T10:00:00Z',
    claimedAt: null,
    referralCode: 'ANN123',
    deletedAt: accountStatus === 'deleted' ? '2026-10-04T10:00:00Z' : null,
    signInMethods: { google: false, email: true },
  };
}

function renderActions(role: AdminRole | undefined, status: UserStatus) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <UserActions user={makeDetail(status)} role={role} />
    </QueryClientProvider>,
  );
}

const names = () => screen.queryAllByRole('button').map((b) => b.textContent);

describe('UserActions', () => {
  it.each(['viewer', 'editor', undefined] as const)('offers %s nothing', (role) => {
    renderActions(role, 'active');
    expect(names()).toEqual([]);
  });

  it('offers an admin adjust, suspend and delete on an active user', () => {
    renderActions('admin', 'active');
    expect(names()).toEqual(['Adjust credits', 'Suspend', 'Delete user']);
  });

  it('offers unsuspend instead of suspend on a suspended user', () => {
    renderActions('admin', 'suspended');
    expect(names()).toEqual(['Adjust credits', 'Unsuspend', 'Delete user']);
  });

  it('offers nothing on a deleted user, even to the owner', () => {
    renderActions('owner', 'deleted');
    expect(names()).toEqual([]);
  });
});
