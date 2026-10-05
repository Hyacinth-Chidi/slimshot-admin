import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as usersApi from '@/lib/api/users';
import { CreditHistory } from './credit-history';

vi.mock('@/lib/api/users', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/users')>('@/lib/api/users');
  return { ...actual, fetchUserLedger: vi.fn() };
});

function renderHistory() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CreditHistory userId="u1" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('CreditHistory', () => {
  it('labels each entry, signs its amount and shows the balance after it', async () => {
    vi.mocked(usersApi.fetchUserLedger).mockResolvedValue({
      items: [
        { id: 't2', type: 'feature_charge', amount: -3, balanceAfter: 122, createdAt: '2026-10-04T10:00:00Z' },
        { id: 't1', type: 'rewarded_ad', amount: 5, balanceAfter: 125, createdAt: '2026-10-03T10:00:00Z' },
      ],
      nextCursor: null,
    });
    renderHistory();

    expect(await screen.findByText('Rewarded ad')).toBeInTheDocument();
    expect(screen.getByText('Auto caption')).toBeInTheDocument();
    expect(screen.getByText('+5')).toHaveClass('text-success');
    expect(screen.getByText('−3')).not.toHaveClass('text-success');
    expect(screen.getByText('Balance 125')).toBeInTheDocument();
    expect(usersApi.fetchUserLedger).toHaveBeenCalledWith('u1', { cursor: undefined, limit: 20 });
  });

  it('says when there is no history yet', async () => {
    vi.mocked(usersApi.fetchUserLedger).mockResolvedValue({ items: [], nextCursor: null });
    renderHistory();
    expect(await screen.findByText('No credit history yet')).toBeInTheDocument();
  });

  it('loads older entries with the cursor', async () => {
    vi.mocked(usersApi.fetchUserLedger)
      .mockResolvedValueOnce({
        items: [{ id: 't2', type: 'rewarded_ad', amount: 5, balanceAfter: 125, createdAt: '2026-10-04T10:00:00Z' }],
        nextCursor: 't2',
      })
      .mockResolvedValueOnce({
        items: [{ id: 't1', type: 'signup_bonus', amount: 100, balanceAfter: 120, createdAt: '2026-10-01T10:00:00Z' }],
        nextCursor: null,
      });
    renderHistory();

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Signup bonus')).toBeInTheDocument();
    expect(usersApi.fetchUserLedger).toHaveBeenLastCalledWith('u1', { cursor: 't2', limit: 20 });
  });
});
