import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import type { UserDetail } from '@/lib/api/users';
import * as usersApi from '@/lib/api/users';
import { AdjustCreditsDialog } from './adjust-credits-dialog';

vi.mock('@/lib/api/users', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/users')>('@/lib/api/users');
  return { ...actual, adjustCredits: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

const user: UserDetail = {
  id: 'u1',
  email: 'ann@example.com',
  username: 'ann',
  accountStatus: 'active',
  creditBalance: 112,
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
      <AdjustCreditsDialog user={user} open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

async function fill(direction: 'Add' | 'Remove', amount: string, reason: string) {
  await userEvent.click(screen.getByRole('button', { name: direction }));
  await userEvent.type(screen.getByLabelText('Amount'), amount);
  await userEvent.type(screen.getByLabelText('Reason'), reason);
}

const submit = () => screen.getByRole('button', { name: 'Save adjustment' });

afterEach(() => {
  vi.resetAllMocks();
});

describe('AdjustCreditsDialog', () => {
  it('sends a removal as a negative amount and closes', async () => {
    vi.mocked(usersApi.adjustCredits).mockResolvedValue({ balance: 92 });
    const { onOpenChange } = renderDialog();

    await fill('Remove', '20', 'Chargeback');
    await userEvent.click(submit());

    expect(usersApi.adjustCredits).toHaveBeenCalledWith('u1', -20, 'Chargeback');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('previews the new balance', async () => {
    renderDialog();
    await fill('Add', '5', 'Goodwill');
    expect(screen.getByText('New balance: 117')).toBeInTheDocument();
  });

  it('refuses to remove more than the balance before asking the server', async () => {
    renderDialog();
    await fill('Remove', '200', 'Chargeback');
    expect(screen.getByText('This would take the balance below zero. Current balance: 112.')).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });

  it("shows the server's below-zero refusal with the balance it reports, staying open", async () => {
    vi.mocked(usersApi.adjustCredits).mockRejectedValue(
      new ApiError(
        { code: 'VALIDATION_FAILED', message: 'This would take the balance below zero.', details: { balance: 12 }, traceId: 't1' },
        422,
      ),
    );
    const { onOpenChange } = renderDialog();

    await fill('Remove', '20', 'Chargeback');
    await userEvent.click(submit());

    expect(await screen.findByText('This would take the balance below zero. Current balance: 12.')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('needs a reason of at least 3 characters', async () => {
    renderDialog();
    await fill('Add', '5', 'no');
    expect(submit()).toBeDisabled();
  });
});
