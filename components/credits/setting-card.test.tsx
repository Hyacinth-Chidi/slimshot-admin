import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuleLike } from '@/components/settings/pricing-format';
import { ApiError } from '@/lib/api/client';
import type { CreditSettings } from '@/lib/api/credits';
import * as creditsApi from '@/lib/api/credits';
import { toast } from '@/lib/use-toast';
import { SettingCard } from './setting-card';
import { REWARD_CARDS } from './setting-cards';

vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, updateCreditSettings: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

const OWNER = { id: 'a1', email: 'owner@slimshot.dev', name: 'Owner' };
const LIVE: RuleLike = { mode: 'per_second', blockSeconds: 30, blockCredits: 2, minCredits: 4, perJobCredits: null, tiers: null };

const SETTINGS: CreditSettings = {
  id: 'default',
  signupBonusCredits: 100,
  adRewardCredits: 5,
  adDailyCap: 10,
  referralInviterCredits: 20,
  referralInviteeCredits: 20,
  referralCapCount: 10,
  referralCapDays: 30,
  ipSignupLimitPer24h: 3,
  disposableEmailDomains: ['mailinator.com'],
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 60,
  otpPerEmailPerHour: 5,
  otpPerDevicePerHour: 10,
  otpPerIpPerHour: 20,
  updatedById: 'a1',
  updatedAt: '2026-10-27T10:00:00Z',
  lastChanged: {
    adDailyCap: { at: '2026-10-27T10:00:00Z', by: OWNER },
    adRewardCredits: { at: '2026-10-12T10:00:00Z', by: OWNER },
  },
};

const ADS = REWARD_CARDS.find((c) => c.id === 'ads')!;
const SIGNUP = REWARD_CARDS.find((c) => c.id === 'signup')!;

function setup(spec = ADS, settings = SETTINGS) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (ui: ReactNode) => <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
  const view = render(wrap(<SettingCard spec={spec} settings={settings} live={LIVE} />));
  return { client, rerender: (s: CreditSettings) => view.rerender(wrap(<SettingCard spec={spec} settings={s} live={LIVE} />)) };
}

const card = (title: string) => screen.getByRole('region', { name: title });
const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

async function retype(label: string, value: string) {
  await userEvent.clear(input(label));
  await userEvent.type(input(label), value);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('SettingCard', () => {
  it('reads as a sentence with the current values', () => {
    setup();
    expect(card('Rewarded ads')).toHaveTextContent('Each ad watched gives credits, up to ads per user a day.');
    expect(input('Credits per ad').value).toBe('5');
    expect(input('Ads per day').value).toBe('10');
    expect(within(card('Rewarded ads')).getByText('Up to 50 credits a day per user.')).toBeInTheDocument();
  });

  it('saves only the fields this card changed', async () => {
    vi.mocked(creditsApi.updateCreditSettings).mockResolvedValue({ ...SETTINGS, adRewardCredits: 6 });
    setup();
    await retype('Credits per ad', '6');
    expect(within(card('Rewarded ads')).getByText('Unsaved')).toBeInTheDocument();
    expect(within(card('Rewarded ads')).getByText('Up to 60 credits a day per user.')).toBeInTheDocument();
    await userEvent.click(within(card('Rewarded ads')).getByRole('button', { name: 'Save' }));

    expect(creditsApi.updateCreditSettings).toHaveBeenCalledTimes(1);
    expect(creditsApi.updateCreditSettings).toHaveBeenCalledWith({ adRewardCredits: 6 });
    expect(toast).toHaveBeenCalledWith('Saved. The app uses the new values within 30 seconds.');
  });

  it('undoes back to the saved values', async () => {
    setup();
    await retype('Credits per ad', '6');
    await userEvent.click(within(card('Rewarded ads')).getByRole('button', { name: 'Undo' }));
    expect(input('Credits per ad').value).toBe('5');
    expect(within(card('Rewarded ads')).queryByText('Unsaved')).toBeNull();
  });

  it('says when its fields last changed, and by whom', () => {
    setup();
    expect(within(card('Rewarded ads')).getByText('Changed 27 Oct by owner@slimshot.dev')).toBeInTheDocument();
    expect(within(card('Rewarded ads')).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('says "Never changed" when none of its fields has', () => {
    setup(SIGNUP);
    expect(within(card('Sign-up bonus')).getByText('Never changed')).toBeInTheDocument();
  });

  it('keeps its own edits when other settings change', async () => {
    const { rerender } = setup();
    await retype('Credits per ad', '6');
    rerender({ ...SETTINGS, signupBonusCredits: 150, adDailyCap: 12 });
    expect(input('Credits per ad').value).toBe('6');
    expect(input('Ads per day').value).toBe('12');
    expect(within(card('Rewarded ads')).getByText('Unsaved')).toBeInTheDocument();
  });

  it("shows a refused field's message under it and stays dirty", async () => {
    vi.mocked(creditsApi.updateCreditSettings).mockRejectedValue(
      new ApiError(
        { code: 'VALIDATION_FAILED', message: 'Request validation failed.', details: ['adRewardCredits must not be greater than 100000'], traceId: 't' },
        422,
      ),
    );
    setup();
    await retype('Credits per ad', '6');
    await userEvent.click(within(card('Rewarded ads')).getByRole('button', { name: 'Save' }));

    // Under the field, linked to it, and named the way the card names it.
    const message = await within(card('Rewarded ads')).findByText('Credits per ad must not be greater than 100000');
    expect(input('Credits per ad')).toHaveAttribute('aria-describedby', message.id);
    expect(input('Credits per ad')).toHaveAttribute('aria-invalid', 'true');
    expect(input('Credits per ad').value).toBe('6');
    expect(within(card('Rewarded ads')).getByText('Unsaved')).toBeInTheDocument();
  });

  it('shows a refusal it cannot place on a field as a summary', async () => {
    vi.mocked(creditsApi.updateCreditSettings).mockRejectedValue(
      new ApiError(
        { code: 'VALIDATION_FAILED', message: 'Request validation failed.', details: ['property surprise should not exist'], traceId: 't' },
        422,
      ),
    );
    setup();
    await retype('Credits per ad', '6');
    await userEvent.click(within(card('Rewarded ads')).getByRole('button', { name: 'Save' }));
    expect(await within(card('Rewarded ads')).findByRole('alert')).toHaveTextContent('property surprise should not exist');
  });

  it('clears a refused message on Undo', async () => {
    vi.mocked(creditsApi.updateCreditSettings).mockRejectedValue(
      new ApiError(
        { code: 'VALIDATION_FAILED', message: 'Request validation failed.', details: ['adRewardCredits must not be greater than 100000'], traceId: 't' },
        422,
      ),
    );
    setup();
    await retype('Credits per ad', '6');
    await userEvent.click(within(card('Rewarded ads')).getByRole('button', { name: 'Save' }));
    await within(card('Rewarded ads')).findByText('Credits per ad must not be greater than 100000');

    await userEvent.click(within(card('Rewarded ads')).getByRole('button', { name: 'Undo' }));
    expect(within(card('Rewarded ads')).queryByText('Credits per ad must not be greater than 100000')).toBeNull();
    expect(input('Credits per ad')).not.toHaveAttribute('aria-invalid');
  });

  it('refuses a value outside its bounds before sending', async () => {
    setup();
    await retype('Ads per day', '5000');
    const message = within(card('Rewarded ads')).getByText('Ads per day must be a whole number from 0 to 1,000.');
    expect(input('Ads per day')).toHaveAttribute('aria-describedby', message.id);
    expect(within(card('Rewarded ads')).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('guards leaving while dirty', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    setup();
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(false);

    await retype('Credits per ad', '6');
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true);

    await userEvent.click(within(card('Rewarded ads')).getByRole('button', { name: 'Undo' }));
    expect(remove.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true);
  });
});
