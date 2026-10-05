import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserDetail } from '@/lib/api/users';
import * as usersApi from '@/lib/api/users';
import { toast } from '@/lib/use-toast';
import { confirmationTarget, DeleteUserDialog, matchesConfirmation } from './delete-user-dialog';

vi.mock('@/lib/api/users', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/users')>('@/lib/api/users');
  return { ...actual, deleteUser: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

function makeUser(overrides: Partial<UserDetail> = {}): UserDetail {
  return {
    id: 'u1',
    email: 'ann@example.com',
    username: 'ann',
    accountStatus: 'active',
    creditBalance: 1200,
    createdAt: '2026-10-01T10:00:00Z',
    claimedAt: null,
    referralCode: null,
    deletedAt: null,
    signInMethods: { google: false, email: true },
    ...overrides,
  };
}

function renderDialog(user: UserDetail) {
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DeleteUserDialog user={user} open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

const deleteButton = () => screen.getByRole('button', { name: 'Delete' });

afterEach(() => {
  vi.resetAllMocks();
});

describe('confirmation', () => {
  it('asks for the email, else the username, else the id', () => {
    expect(confirmationTarget(makeUser())).toBe('ann@example.com');
    expect(confirmationTarget(makeUser({ email: null }))).toBe('ann');
    expect(confirmationTarget(makeUser({ email: null, username: null }))).toBe('u1');
  });

  it('ignores case and surrounding spaces', () => {
    expect(matchesConfirmation('  ANN@Example.com ', 'ann@example.com')).toBe(true);
    expect(matchesConfirmation('ann@example.co', 'ann@example.com')).toBe(false);
  });
});

describe('DeleteUserDialog', () => {
  it('warns what is lost and stays disabled until the email is typed', async () => {
    vi.mocked(usersApi.deleteUser).mockResolvedValue({ deleted: true });
    const { onOpenChange } = renderDialog(makeUser());

    expect(
      screen.getByText("This can't be undone. Their personal data is erased and their 1,200 credits are forfeited."),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Reason'), 'Asked by email');
    expect(deleteButton()).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Type ann@example.com to confirm'), '  ANN@Example.com ');
    expect(deleteButton()).toBeEnabled();
    await userEvent.click(deleteButton());

    expect(usersApi.deleteUser).toHaveBeenCalledWith('u1', 'Asked by email');
    expect(toast).toHaveBeenCalledWith('User deleted');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('confirms with the username when the user has no email', async () => {
    renderDialog(makeUser({ email: null }));
    expect(screen.getByLabelText('Type ann to confirm')).toBeInTheDocument();
  });

  it('needs a reason as well as the confirmation', async () => {
    renderDialog(makeUser());
    await userEvent.type(screen.getByLabelText('Type ann@example.com to confirm'), 'ann@example.com');
    await userEvent.type(screen.getByLabelText('Reason'), 'no');
    expect(deleteButton()).toBeDisabled();
  });
});
