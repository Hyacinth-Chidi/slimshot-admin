import { apiFetch } from './client';
import { withRefresh } from '@/lib/auth/session';

/**
 * Wraps the server's credit routes: settings, Auto caption pricing, the
 * balance check and credit stats (../slimshot_server/docs/admin-credits-api.md
 * §1–3 and §5). Settings, pricing and the balance check are owner-only.
 */
export type CreditTxType =
  | 'signup_bonus'
  | 'referral_inviter'
  | 'referral_invitee'
  | 'rewarded_ad'
  | 'feature_charge'
  | 'feature_refund'
  | 'admin_adjustment'
  | 'account_deleted'
  | 'purchase';

export const LEDGER_LABELS: Record<CreditTxType, string> = {
  signup_bonus: 'Signup bonus',
  referral_inviter: 'Referral reward (invited someone)',
  referral_invitee: 'Referral bonus (was invited)',
  rewarded_ad: 'Rewarded ad',
  feature_charge: 'Auto caption',
  feature_refund: 'Auto caption refund',
  admin_adjustment: 'Adjustment by an admin',
  account_deleted: 'Forfeited on deletion',
  purchase: 'Purchase',
};

/** Unknown types show their code: the server can add one before the dashboard learns its name. */
export function ledgerLabel(type: string): string {
  return LEDGER_LABELS[type as CreditTxType] ?? type;
}

export interface CreditSettings {
  id: string;
  signupBonusCredits: number;
  adRewardCredits: number;
  adDailyCap: number;
  referralInviterCredits: number;
  referralInviteeCredits: number;
  referralCapCount: number;
  referralCapDays: number;
  ipSignupLimitPer24h: number;
  disposableEmailDomains: string[];
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  otpPerEmailPerHour: number;
  otpPerDevicePerHour: number;
  otpPerIpPerHour: number;
  updatedById: string | null;
  updatedAt: string;
}

export type CreditSettingsPatch = Partial<Omit<CreditSettings, 'id' | 'updatedById' | 'updatedAt'>>;

export function fetchCreditSettings(): Promise<CreditSettings> {
  return withRefresh(() => apiFetch<CreditSettings>('/credit-settings'));
}

export function updateCreditSettings(patch: CreditSettingsPatch): Promise<CreditSettings> {
  return withRefresh(() =>
    apiFetch<CreditSettings>('/credit-settings', { method: 'PUT', body: JSON.stringify(patch) }),
  );
}

export type CreditFeature = 'auto_captions';
export type PricingMode = 'per_job' | 'duration_tiers' | 'per_second';

export interface PriceTier {
  /** Inclusive upper bound in seconds; `null` only on the last, open-ended tier. */
  upToSeconds: number | null;
  credits: number;
}

export interface PricingRule {
  id: string;
  feature: CreditFeature;
  version: number;
  mode: PricingMode;
  perJobCredits: number | null;
  tiers: PriceTier[] | null;
  /** per_second: credits per started block of this many seconds, never below minCredits. */
  blockSeconds: number | null;
  blockCredits: number | null;
  minCredits: number | null;
  isActive: boolean;
  note: string | null;
  createdById: string;
  createdAt: string;
  activatedAt: string | null;
}

export interface NewPricingRule {
  feature: CreditFeature;
  mode: PricingMode;
  perJobCredits?: number;
  tiers?: PriceTier[];
  blockSeconds?: number;
  blockCredits?: number;
  minCredits?: number;
  note?: string;
}

export function fetchPricingRules(feature: CreditFeature): Promise<PricingRule[]> {
  return withRefresh(() =>
    apiFetch<PricingRule[]>(`/pricing-rules?feature=${encodeURIComponent(feature)}`),
  );
}

export function createPricingRule(rule: NewPricingRule): Promise<PricingRule> {
  return withRefresh(() =>
    apiFetch<PricingRule>('/pricing-rules', { method: 'POST', body: JSON.stringify(rule) }),
  );
}

export function activatePricingRule(id: string): Promise<PricingRule[]> {
  return withRefresh(() =>
    apiFetch<PricingRule[]>(`/pricing-rules/${encodeURIComponent(id)}/activate`, { method: 'POST' }),
  );
}

export interface BalanceMismatch {
  userId: string;
  cached: number;
  ledger: number;
}

export function checkBalances(): Promise<{ mismatches: BalanceMismatch[] }> {
  return withRefresh(() => apiFetch<{ mismatches: BalanceMismatch[] }>('/credits/reconciliation'));
}

export interface CreditStatsRow {
  day: string;
  type: string;
  granted: number;
  spent: number;
}

export function fetchCreditStats(days: number): Promise<CreditStatsRow[]> {
  return withRefresh(() => apiFetch<CreditStatsRow[]>(`/stats/credits?days=${days}`));
}

export interface CreditDay {
  date: string;
  granted: number;
  spent: number;
  byType: Record<string, { granted: number; spent: number }>;
}

/**
 * The API returns only days and types that have entries. Like zeroFill in
 * stats.ts, this lays them on a full window — oldest first, ending today
 * (UTC) — so an empty day reads as zero instead of disappearing.
 */
export function creditDays(rows: CreditStatsRow[], days: number, today = new Date()): CreditDay[] {
  const byDate = new Map<string, CreditStatsRow[]>();
  for (const row of rows) byDate.set(row.day, [...(byDate.get(row.day) ?? []), row]);

  const out: CreditDay[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const day: CreditDay = { date, granted: 0, spent: 0, byType: {} };
    for (const row of byDate.get(date) ?? []) {
      day.granted += row.granted;
      day.spent += row.spent;
      day.byType[row.type] = { granted: row.granted, spent: row.spent };
    }
    out.push(day);
  }
  return out;
}
