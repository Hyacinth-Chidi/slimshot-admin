import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as creditsApi from '@/lib/api/credits';
import { CreditsBySource } from './credits-by-source';

vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, fetchCreditStats: vi.fn() };
});

const today = new Date().toISOString().slice(0, 10);

function renderChart() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CreditsBySource />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(creditsApi.fetchCreditStats).mockResolvedValue([
    { day: today, type: 'rewarded_ad', granted: 910, spent: 0 },
    { day: today, type: 'signup_bonus', granted: 2300, spent: 0 },
    { day: today, type: 'referral_inviter', granted: 200, spent: 0 },
    { day: today, type: 'referral_invitee', granted: 125, spent: 0 },
    // Not a way users earn: left out of this chart.
    { day: today, type: 'feature_refund', granted: 32, spent: 0 },
    { day: today, type: 'feature_charge', granted: 0, spent: 1515 },
  ]);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('CreditsBySource', () => {
  it('totals each source over the last 30 days in the legend', async () => {
    renderChart();
    const legend = await screen.findByRole('list', { name: 'Sources' });
    expect(within(legend).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Ads 910',
      'Sign-up 2,300',
      'Referrals 325',
    ]);
    expect(creditsApi.fetchCreditStats).toHaveBeenCalledWith(30);
  });

  it('draws a column for every one of the 30 days, empty ones included', async () => {
    renderChart();
    await screen.findByRole('list', { name: 'Sources' });
    expect(screen.getAllByTestId('source-day')).toHaveLength(30);
  });

  it('says the totals in words for screen readers', async () => {
    renderChart();
    expect(
      await screen.findByText('Over the last 30 days users got 910 credits from ads, 2,300 from sign-up bonuses and 325 from referrals.'),
    ).toBeInTheDocument();
  });

  it('keeps a table of every day', async () => {
    renderChart();
    const table = await screen.findByRole('table', { name: 'Credits given each day, by source' });
    expect(within(table).getAllByRole('row')).toHaveLength(31);
  });

  it('reads out a day on focus, values first', async () => {
    renderChart();
    await screen.findByRole('list', { name: 'Sources' });
    const plot = screen.getByRole('group', { name: 'Credits given each day' });
    fireEvent.focus(plot);
    fireEvent.keyDown(plot, { key: 'End' });
    const readout = screen.getByTestId('source-readout');
    expect(readout).toHaveTextContent('910 Ads');
    expect(readout).toHaveTextContent('2,300 Sign-up');
    expect(readout).toHaveTextContent('325 Referrals');
  });
});
