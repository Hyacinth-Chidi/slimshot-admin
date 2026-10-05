import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as creditsApi from '@/lib/api/credits';
import { BalanceCheck } from './balance-check';

vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, checkBalances: vi.fn() };
});

function renderCheck() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <BalanceCheck />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('BalanceCheck', () => {
  it('runs only when asked, and says when every balance matches', async () => {
    vi.mocked(creditsApi.checkBalances).mockResolvedValue({ mismatches: [] });
    renderCheck();

    expect(creditsApi.checkBalances).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Check balances' }));
    expect(await screen.findByText('Every balance matches its history')).toBeInTheDocument();
  });

  it('lists each mismatch with a link to the user', async () => {
    vi.mocked(creditsApi.checkBalances).mockResolvedValue({
      mismatches: [{ userId: 'u1', cached: 40, ledger: 35 }],
    });
    renderCheck();

    await userEvent.click(screen.getByRole('button', { name: 'Check balances' }));
    expect(await screen.findByRole('link', { name: 'u1' })).toHaveAttribute('href', '/users/u1');
    expect(screen.getByText('stored 40 · history 35')).toBeInTheDocument();
  });
});
