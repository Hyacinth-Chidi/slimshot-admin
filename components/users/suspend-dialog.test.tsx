import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import type { UserDetail } from '@/lib/api/users';
import * as usersApi from '@/lib/api/users';
import { toast } from '@/lib/use-toast';
import { SuspendDialog } from './suspend-dialog';

vi.mock('@/lib/api/users', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/users')>('@/lib/api/users');
  return { ...actual, suspendUser: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

const user: UserDetail = {
  id: 'u1',
  email: 'ann@example.com',
  username: 'ann',
  accountStatus: 'active',
  creditBalance: 12,
  createdAt: '2026-10-01T10:00:00Z',
  claimedAt: null,
  referralCode: null,
  deletedAt: null,
  signInMethods: { google: false, email: true },
};

function renderDialog() {
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SuspendDialog user={user} open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('SuspendDialog', () => {
  it('explains what a suspension does and sends the reason', async () => {
    vi.mocked(usersApi.suspendUser).mockResolvedValue({ ...user, accountStatus: 'suspended' });
    const { onOpenChange } = renderDialog();

    expect(
      screen.getByText("They stay signed in but can't spend credits, earn from ads or claim a bonus."),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Reason'), 'Ad reward abuse');
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    expect(usersApi.suspendUser).toHaveBeenCalledWith('u1', 'Ad reward abuse');
    expect(toast).toHaveBeenCalledWith('User suspended');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('toasts a conflict and closes, since someone else changed the user first', async () => {
    vi.mocked(usersApi.suspendUser).mockRejectedValue(
      new ApiError({ code: 'CONFLICT', message: 'This account is suspended, not active.', traceId: 't1' }, 409),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { onOpenChange } = renderDialog();

    await userEvent.type(screen.getByLabelText('Reason'), 'Ad reward abuse');
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    expect(toast).toHaveBeenCalledWith('This account is suspended, not active.', 'error');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
