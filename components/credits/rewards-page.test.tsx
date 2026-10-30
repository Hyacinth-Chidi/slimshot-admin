import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreditSettings, PricingRule } from '@/lib/api/credits';
import * as creditsApi from '@/lib/api/credits';
import { RewardsPage } from './rewards-page';

vi.mock('next/navigation', () => ({ usePathname: () => '/credits/rewards' }));
vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, fetchCreditSettings: vi.fn(), fetchPricingRules: vi.fn(), fetchCreditStats: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

const SETTINGS = {
  id: 'default',
  signupBonusCredits: 100,
  adRewardCredits: 5,
  adDailyCap: 10,
  referralInviterCredits: 20,
  referralInviteeCredits: 20,
  referralCapCount: 10,
  referralCapDays: 30,
  ipSignupLimitPer24h: 3,
  disposableEmailDomains: [],
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 60,
  otpPerEmailPerHour: 5,
  otpPerDevicePerHour: 10,
  otpPerIpPerHour: 20,
  dailyRewardEnabled: true,
  dailyRewardCredits: 5,
  updatedById: null,
  updatedAt: '2026-10-27T10:00:00Z',
  lastChanged: {},
} as CreditSettings;

const LIVE = {
  id: 'p3', feature: 'auto_captions', version: 3, mode: 'per_second', perJobCredits: null, tiers: null,
  blockSeconds: 30, blockCredits: 2, minCredits: 4, isActive: true, note: null, createdById: 'a1',
  createdAt: '2026-10-23T09:00:00Z', activatedAt: '2026-10-23T09:00:00Z',
} as PricingRule;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RewardsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(creditsApi.fetchCreditSettings).mockResolvedValue(SETTINGS);
  vi.mocked(creditsApi.fetchPricingRules).mockResolvedValue([LIVE]);
  vi.mocked(creditsApi.fetchCreditStats).mockResolvedValue([]);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('RewardsPage', () => {
  it('shows the four reward cards with their hints', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Rewards' })).toBeInTheDocument();
    expect(
      screen.getByText('Free credits users get from the sign-up bonus, ads, referrals and daily claims. Each card saves on its own.'),
    ).toBeInTheDocument();

    const signup = await screen.findByRole('region', { name: 'Sign-up bonus' });
    expect(await within(signup).findByText("≈ 25 min of captions at today's price.")).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Rewarded ads' })).getByText('Up to 50 credits a day per user.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Referrals' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Daily credits' })).getByRole('switch', { name: 'Give daily credits' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('leaves out the captions hint when no price is live', async () => {
    vi.mocked(creditsApi.fetchPricingRules).mockResolvedValue([{ ...LIVE, isActive: false }]);
    renderPage();
    const signup = await screen.findByRole('region', { name: 'Sign-up bonus' });
    expect(within(signup).queryByText(/of captions at today's price/)).toBeNull();
  });

  it('keeps the balance check at the bottom', async () => {
    renderPage();
    await screen.findByRole('region', { name: 'Sign-up bonus' });
    expect(screen.getByRole('button', { name: 'Check balances' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Last 30 days' })).toBeInTheDocument();
  });
});
