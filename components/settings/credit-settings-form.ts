import type { CreditSettings, CreditSettingsPatch } from '@/lib/api/credits';

export type NumericSettingKey = Exclude<keyof CreditSettingsPatch, 'disposableEmailDomains'>;

export interface CreditField {
  key: NumericSettingKey;
  label: string;
  min: number;
  max: number;
}

/** Spec §6.1, in order. The bounds are the server's (UpdateCreditSettingsDto). */
export const CREDIT_FIELD_GROUPS: Array<{ title: string; fields: CreditField[] }> = [
  {
    title: 'Rewards',
    fields: [
      { key: 'signupBonusCredits', label: 'Signup bonus', min: 0, max: 100_000 },
      { key: 'adRewardCredits', label: 'Credits per rewarded ad', min: 0, max: 100_000 },
      { key: 'adDailyCap', label: 'Rewarded ads per day', min: 0, max: 1_000 },
    ],
  },
  {
    title: 'Referrals',
    fields: [
      { key: 'referralInviterCredits', label: 'Inviter gets', min: 0, max: 100_000 },
      { key: 'referralInviteeCredits', label: 'Invited person gets', min: 0, max: 100_000 },
      { key: 'referralCapCount', label: 'Rewarded referrals per inviter', min: 0, max: 10_000 },
      { key: 'referralCapDays', label: 'Within days', min: 1, max: 365 },
    ],
  },
  {
    title: 'Abuse limits',
    fields: [
      { key: 'ipSignupLimitPer24h', label: 'New accounts per IP per 24 h', min: 1, max: 100_000 },
      { key: 'otpMaxAttempts', label: 'Wrong code attempts', min: 1, max: 20 },
      { key: 'otpResendCooldownSeconds', label: 'Wait between codes (s)', min: 0, max: 3_600 },
      { key: 'otpPerEmailPerHour', label: 'Codes per email per hour', min: 1, max: 10_000 },
      { key: 'otpPerDevicePerHour', label: 'Codes per install per hour', min: 1, max: 10_000 },
      { key: 'otpPerIpPerHour', label: 'Codes per IP per hour', min: 1, max: 10_000 },
    ],
  },
];

const NUMERIC_KEYS = CREDIT_FIELD_GROUPS.flatMap((group) => group.fields.map((field) => field.key));

export type FormValues = Record<NumericSettingKey, string> & { domains: string };

/** One lowercase domain per entry, in first-seen order: how the server stores and compares them. */
export function normalizeDomains(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[\s,]+/)) {
    const domain = part.trim().toLowerCase();
    if (domain) seen.add(domain);
  }
  return [...seen];
}

export function toFormValues(settings: CreditSettings): FormValues {
  const values = { domains: settings.disposableEmailDomains.join('\n') } as FormValues;
  for (const key of NUMERIC_KEYS) values[key] = String(settings[key]);
  return values;
}

/** A whole number within the field's bounds, or null. */
export function parseField(field: CreditField, raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= field.min && value <= field.max ? value : null;
}

/** Only what differs from the saved settings, so a save never rewrites values nobody touched. */
export function changedFields(initial: CreditSettings, form: FormValues): CreditSettingsPatch {
  const patch: CreditSettingsPatch = {};
  for (const key of NUMERIC_KEYS) {
    const value = Number(form[key].trim());
    if (form[key].trim() !== '' && Number.isFinite(value) && value !== initial[key]) patch[key] = value;
  }
  const domains = normalizeDomains(form.domains);
  const saved = initial.disposableEmailDomains;
  if (domains.length !== saved.length || domains.some((d, i) => d !== saved[i])) {
    patch.disposableEmailDomains = domains;
  }
  return patch;
}
