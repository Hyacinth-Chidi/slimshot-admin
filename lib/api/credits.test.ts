import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from '@/lib/api/client';
import {
  activatePricingRule,
  checkBalances,
  createPricingRule,
  creditDays,
  creditTotals,
  fetchCreditSettings,
  fetchCreditStats,
  fetchPricingRules,
  ledgerLabel,
  updateCreditSettings,
} from './credits';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/lib/auth/session', () => ({ withRefresh: (fn: () => unknown) => fn() }));

afterEach(() => {
  vi.resetAllMocks();
});

describe('credits API', () => {
  it('reads and updates the credit settings', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({});
    await fetchCreditSettings();
    expect(client.apiFetch).toHaveBeenCalledWith('/credit-settings');
    await updateCreditSettings({ adDailyCap: 5 });
    expect(client.apiFetch).toHaveBeenLastCalledWith('/credit-settings', {
      method: 'PUT',
      body: JSON.stringify({ adDailyCap: 5 }),
    });
  });

  it('lists, creates and activates pricing rules', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue([]);
    await fetchPricingRules('auto_captions');
    expect(client.apiFetch).toHaveBeenCalledWith('/pricing-rules?feature=auto_captions');

    const rule = {
      feature: 'auto_captions' as const,
      mode: 'duration_tiers' as const,
      tiers: [{ upToSeconds: 60, credits: 2 }, { upToSeconds: null, credits: 5 }],
    };
    await createPricingRule(rule);
    expect(client.apiFetch).toHaveBeenLastCalledWith('/pricing-rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    });

    await activatePricingRule('r 1');
    expect(client.apiFetch).toHaveBeenLastCalledWith('/pricing-rules/r%201/activate', { method: 'POST' });
  });

  it('runs the balance check and reads credit stats', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ mismatches: [] });
    await checkBalances();
    expect(client.apiFetch).toHaveBeenCalledWith('/credits/reconciliation');
    vi.mocked(client.apiFetch).mockResolvedValue([]);
    await fetchCreditStats(30);
    expect(client.apiFetch).toHaveBeenLastCalledWith('/stats/credits?days=30');
  });
});

describe('ledgerLabel', () => {
  it('names known entry types and shows unknown ones as their code', () => {
    expect(ledgerLabel('rewarded_ad')).toBe('Rewarded ad');
    expect(ledgerLabel('daily_reward')).toBe('Claimed credits');
    expect(ledgerLabel('new_thing')).toBe('new_thing');
  });

  // Every charge read as Auto caption, Text to speech's included: the entry
  // said a feature was paid for, never which.
  it('names a charge or a refund by the feature it was for', () => {
    expect(ledgerLabel('feature_charge', 'auto_captions')).toBe('Auto caption');
    expect(ledgerLabel('feature_charge', 'text_to_speech')).toBe('Text to speech');
    expect(ledgerLabel('feature_refund', 'auto_captions')).toBe('Auto caption refund');
    expect(ledgerLabel('feature_refund', 'text_to_speech')).toBe('Text to speech refund');
  });

  it('names no feature it was not told, or does not know', () => {
    // Stats are kept by type, so a day's charges are every paid feature's.
    expect(ledgerLabel('feature_charge')).toBe('Paid feature');
    expect(ledgerLabel('feature_refund', null)).toBe('Paid feature refund');
    expect(ledgerLabel('feature_charge', 'something_new')).toBe('Paid feature');
    // A feature on any other entry changes nothing.
    expect(ledgerLabel('rewarded_ad', 'text_to_speech')).toBe('Rewarded ad');
  });
});

describe('creditDays', () => {
  it('zero-fills the window, sums each day and keeps a per-type breakdown', () => {
    const today = new Date('2026-10-05T15:00:00Z');
    const days = creditDays(
      [
        { day: '2026-10-03', type: 'rewarded_ad', granted: 10, spent: 0 },
        { day: '2026-10-05', type: 'rewarded_ad', granted: 5, spent: 0 },
        { day: '2026-10-05', type: 'feature_charge', granted: 0, spent: 4 },
      ],
      3,
      today,
    );
    expect(days).toEqual([
      { date: '2026-10-03', granted: 10, spent: 0, byType: { rewarded_ad: { granted: 10, spent: 0 } } },
      { date: '2026-10-04', granted: 0, spent: 0, byType: {} },
      {
        date: '2026-10-05',
        granted: 5,
        spent: 4,
        byType: { rewarded_ad: { granted: 5, spent: 0 }, feature_charge: { granted: 0, spent: 4 } },
      },
    ]);
  });
});

// The Overview's Credits spent card: what people used on paid features, and
// the free credits handed out.
describe('creditTotals', () => {
  const row = (type: string, granted: number, spent: number, day = '2026-11-16') => ({ day, type, granted, spent });

  it('counts paid features, refunds taken off, across every day', () => {
    expect(
      creditTotals([
        row('feature_charge', 0, 60, '2026-11-14'),
        row('feature_charge', 0, 40),
        row('feature_refund', 10, 0),
      ]).spent,
    ).toBe(90);
  });

  it('counts the free credits as given, never a refund or a purchase', () => {
    expect(
      creditTotals([
        row('signup_bonus', 100, 0),
        row('referral_inviter', 20, 0),
        row('referral_invitee', 20, 0),
        row('rewarded_ad', 25, 0),
        row('daily_reward', 5, 0),
        row('admin_adjustment', 50, 0),
        row('feature_refund', 10, 0),
        row('purchase', 500, 0),
      ]).given,
    ).toBe(220);
  });

  it('spends nothing on credits taken away or forfeited', () => {
    expect(creditTotals([row('admin_adjustment', 0, 30), row('account_deleted', 0, 80)]).spent).toBe(0);
  });

  it('is nothing for an empty window', () => {
    expect(creditTotals([])).toEqual({ spent: 0, given: 0 });
  });

  // A charge from before the window refunded inside it.
  it('never spends less than nothing', () => {
    expect(creditTotals([row('feature_charge', 0, 5), row('feature_refund', 20, 0)]).spent).toBe(0);
  });

  // The server can add a type before the dashboard learns its name.
  it('counts a type it does not know as given, never as spent', () => {
    expect(creditTotals([row('promo_code', 15, 0), row('something_taken', 0, 9)])).toEqual({ spent: 0, given: 15 });
  });
});
