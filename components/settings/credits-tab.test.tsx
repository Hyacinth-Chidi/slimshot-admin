import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import type { CreditSettings } from '@/lib/api/credits';
import * as creditsApi from '@/lib/api/credits';
import { CreditsTab } from './credits-tab';

vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, fetchCreditSettings: vi.fn(), updateCreditSettings: vi.fn(), checkBalances: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

const settings: CreditSettings = {
  id: 'default',
  signupBonusCredits: 100,
  adRewardCredits: 5,
  adDailyCap: 10,
  referralInviterCredits: 20,
  referralInviteeCredits: 20,
  referralCapCount: 10,
  referralCapDays: 30,
  ipSignupLimitPer24h: 10,
  disposableEmailDomains: ['mailinator.com', 'yopmail.com'],
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 60,
  otpPerEmailPerHour: 5,
  otpPerDevicePerHour: 10,
  otpPerIpPerHour: 20,
  updatedById: null,
  updatedAt: '2026-10-04T09:00:00Z',
};

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CreditsTab />
    </QueryClientProvider>,
  );
}

const save = () => screen.getByRole('button', { name: 'Save' });

async function setField(label: string, value: string) {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, value);
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('CreditsTab', () => {
  it('shows every amount and limit with its saved value', async () => {
    vi.mocked(creditsApi.fetchCreditSettings).mockResolvedValue(settings);
    renderTab();

    expect(await screen.findByLabelText('Signup bonus')).toHaveValue(100);
    for (const title of ['Rewards', 'Referrals', 'Abuse limits', 'Disposable email domains']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Rewarded ads per day')).toHaveValue(10);
    expect(screen.getByLabelText('Codes per IP per hour')).toHaveValue(20);
    expect(screen.getByText('2 domains')).toBeInTheDocument();
    expect(screen.getByText(/Last changed/)).toBeInTheDocument();
    expect(creditsApi.checkBalances).not.toHaveBeenCalled();
  });

  it('saves only what changed', async () => {
    vi.mocked(creditsApi.fetchCreditSettings).mockResolvedValue(settings);
    vi.mocked(creditsApi.updateCreditSettings).mockResolvedValue({ ...settings, adDailyCap: 5 });
    renderTab();

    await screen.findByLabelText('Signup bonus');
    expect(save()).toBeDisabled();
    await setField('Rewarded ads per day', '5');
    await userEvent.click(save());

    expect(creditsApi.updateCreditSettings).toHaveBeenCalledWith({ adDailyCap: 5 });
  });

  it('refuses a value outside the allowed range before sending', async () => {
    vi.mocked(creditsApi.fetchCreditSettings).mockResolvedValue(settings);
    renderTab();

    await screen.findByLabelText('Signup bonus');
    await setField('Rewarded ads per day', '5000');
    expect(screen.getByText('A whole number from 0 to 1,000')).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('shows a refused domain list under the domains, never failing silently', async () => {
    vi.mocked(creditsApi.fetchCreditSettings).mockResolvedValue(settings);
    vi.mocked(creditsApi.updateCreditSettings).mockRejectedValue(
      new ApiError(
        {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed.',
          details: ['each value in disposableEmailDomains must be a valid domain name'],
          traceId: 't1',
        },
        422,
      ),
    );
    renderTab();

    const domains = await screen.findByRole('textbox');
    await userEvent.type(domains, '{Enter}*.bad');
    await userEvent.click(save());

    expect(
      await screen.findByText('each value in disposableEmailDomains must be a valid domain name'),
    ).toBeInTheDocument();
  });

  it('shows a refusal it cannot place on a field as a summary', async () => {
    vi.mocked(creditsApi.fetchCreditSettings).mockResolvedValue(settings);
    vi.mocked(creditsApi.updateCreditSettings).mockRejectedValue(
      new ApiError(
        { code: 'VALIDATION_FAILED', message: 'Validation failed.', details: ['property foo should not exist'], traceId: 't1' },
        422,
      ),
    );
    renderTab();

    await screen.findByLabelText('Signup bonus');
    await setField('Rewarded ads per day', '7');
    await userEvent.click(save());

    expect(await screen.findByText('property foo should not exist')).toBeInTheDocument();
  });

  it("puts the server's field error under that field", async () => {
    vi.mocked(creditsApi.fetchCreditSettings).mockResolvedValue(settings);
    vi.mocked(creditsApi.updateCreditSettings).mockRejectedValue(
      new ApiError(
        {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed.',
          details: ['adDailyCap must not be greater than 1000'],
          traceId: 't1',
        },
        422,
      ),
    );
    renderTab();

    await screen.findByLabelText('Signup bonus');
    await setField('Rewarded ads per day', '7');
    await userEvent.click(save());

    expect(await screen.findByText('adDailyCap must not be greater than 1000')).toBeInTheDocument();
  });
});
