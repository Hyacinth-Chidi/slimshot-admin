import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreditSettings } from '@/lib/api/credits';
import * as creditsApi from '@/lib/api/credits';
import { CREDIT_SETTINGS_KEY } from '@/lib/api/credits';
import { formatShortDate } from '@/lib/format';
import { toast } from '@/lib/use-toast';
import { DailyCreditsCard } from './daily-credits-card';

vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, updateCreditSettings: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

afterEach(() => {
  vi.resetAllMocks();
});

const OWNER = { id: 'a1', email: 'owner@slimshot.dev', name: 'Owner' };
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
  dailyRewardEnabled: false,
  dailyRewardCredits: 5,
  updatedById: 'a1',
  updatedAt: '2026-10-27T10:00:00Z',
  lastChanged: {},
} satisfies CreditSettings;

function setup(settings: CreditSettings = SETTINGS) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(CREDIT_SETTINGS_KEY, settings);
  const wrap = (ui: ReactNode) => <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
  render(wrap(<DailyCreditsCard settings={settings} />));
  return { client };
}

const toggle = () => screen.getByRole('switch', { name: 'Give daily credits' });
const amount = () => screen.getByLabelText('Credits per day') as HTMLInputElement;
const save = () => screen.getByRole('button', { name: 'Save' });

async function retype(value: string) {
  await userEvent.clear(amount());
  if (value) await userEvent.type(amount(), value);
}

describe('DailyCreditsCard', () => {
  it('shows the saved values, switched off, with nothing to save', () => {
    setup();
    expect(screen.getByRole('region', { name: 'Daily credits' })).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    expect(amount()).toHaveValue('5');
    expect(screen.getByText(/claim/)).toHaveTextContent('Each user can claim credits once every 24 hours.');
    expect(save()).toBeDisabled();
    expect(screen.getByText('Never changed')).toBeInTheDocument();
  });

  it('switches daily credits on, sending only that, and keeps the page in step', async () => {
    const { client } = setup();
    vi.mocked(creditsApi.updateCreditSettings).mockResolvedValue({ ...SETTINGS, dailyRewardEnabled: true });

    await userEvent.click(toggle());
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
    await userEvent.click(save());

    expect(creditsApi.updateCreditSettings).toHaveBeenCalledWith({ dailyRewardEnabled: true });
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('Saved. The app uses the new values within 30 seconds.'));
    expect(client.getQueryData<CreditSettings>(CREDIT_SETTINGS_KEY)?.dailyRewardEnabled).toBe(true);
  });

  it('changes the amount, sending only that', async () => {
    setup();
    vi.mocked(creditsApi.updateCreditSettings).mockResolvedValue({ ...SETTINGS, dailyRewardCredits: 12 });

    await retype('12');
    await userEvent.click(save());

    expect(creditsApi.updateCreditSettings).toHaveBeenCalledWith({ dailyRewardCredits: 12 });
  });

  it.each(['0', '2.5', 'abc', '100001', ''])('refuses %j as an amount, saying why', async (value) => {
    setup();
    await retype(value);
    expect(screen.getByText('Credits per day must be a whole number from 1 to 100,000.')).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('puts the saved values back on Undo', async () => {
    setup();
    await userEvent.click(toggle());
    await retype('9');
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    expect(amount()).toHaveValue('5');
    expect(save()).toBeDisabled();
  });

  it('says who changed it last', () => {
    setup({
      ...SETTINGS,
      lastChanged: {
        dailyRewardEnabled: { at: '2026-10-20T10:00:00Z', by: OWNER },
        dailyRewardCredits: { at: '2026-10-27T10:00:00Z', by: OWNER },
      },
    });
    expect(screen.getByText(`Changed ${formatShortDate('2026-10-27T10:00:00Z')} by owner@slimshot.dev`)).toBeInTheDocument();
  });

  it('shows nothing while the server is older than daily credits', () => {
    const { dailyRewardEnabled: _on, dailyRewardCredits: _credits, ...older } = SETTINGS;
    setup(older);
    expect(screen.queryByRole('region', { name: 'Daily credits' })).toBeNull();
  });
});
