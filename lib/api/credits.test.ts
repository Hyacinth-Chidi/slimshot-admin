import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from '@/lib/api/client';
import {
  activatePricingRule,
  checkBalances,
  createPricingRule,
  creditDays,
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
    expect(ledgerLabel('feature_refund')).toBe('Auto caption refund');
    expect(ledgerLabel('new_thing')).toBe('new_thing');
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
