import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserDetail } from '@/lib/api/users';
import * as usersApi from '@/lib/api/users';
import { toast } from '@/lib/use-toast';
import { UnsuspendDialog } from './unsuspend-dialog';

vi.mock('@/lib/api/users', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/users')>('@/lib/api/users');
  return { ...actual, unsuspendUser: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

const user: UserDetail = {
  id: 'u1',
  email: 'ann@example.com',
  username: 'ann',
  accountStatus: 'suspended',
  creditBalance: 12,
  createdAt: '2026-10-01T10:00:00Z',
  claimedAt: null,
  referralCode: null,
  deletedAt: null,
  signInMethods: { google: false, email: true },
};

afterEach(() => {
  vi.resetAllMocks();
});

describe('UnsuspendDialog', () => {
  it('lifts the suspension on confirm', async () => {
    vi.mocked(usersApi.unsuspendUser).mockResolvedValue({ ...user, accountStatus: 'active' });
    const onOpenChange = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <UnsuspendDialog user={user} open onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Unsuspend' }));

    expect(usersApi.unsuspendUser).toHaveBeenCalledWith('u1');
    expect(toast).toHaveBeenCalledWith('Suspension lifted');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
