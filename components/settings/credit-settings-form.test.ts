import { describe, expect, it } from 'vitest';
import type { CreditSettings } from '@/lib/api/credits';
import { CREDIT_FIELD_GROUPS, changedFields, normalizeDomains, toFormValues } from './credit-settings-form';

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

describe('normalizeDomains', () => {
  it('splits on lines, commas and spaces, lowercases, drops blanks and duplicates', () => {
    expect(normalizeDomains('Mailinator.com, foo.com\n\nfoo.com  BAR.io')).toEqual([
      'mailinator.com',
      'foo.com',
      'bar.io',
    ]);
  });
});

describe('changedFields', () => {
  it('is empty for an untouched form', () => {
    expect(changedFields(settings, toFormValues(settings))).toEqual({});
  });

  it('holds only the edited field', () => {
    expect(changedFields(settings, { ...toFormValues(settings), adDailyCap: '5' })).toEqual({ adDailyCap: 5 });
  });

  it('leaves out a domain list that only changed in case or repeats', () => {
    const form = { ...toFormValues(settings), domains: 'MAILINATOR.com\nyopmail.com, mailinator.com' };
    expect(changedFields(settings, form)).toEqual({});
  });

  it('sends the whole normalised list when a domain is added', () => {
    const form = { ...toFormValues(settings), domains: 'mailinator.com\nyopmail.com\nTempMail.dev' };
    expect(changedFields(settings, form)).toEqual({
      disposableEmailDomains: ['mailinator.com', 'yopmail.com', 'tempmail.dev'],
    });
  });
});

describe('CREDIT_FIELD_GROUPS', () => {
  it('covers every numeric setting once, in the spec order of groups', () => {
    expect(CREDIT_FIELD_GROUPS.map((g) => g.title)).toEqual(['Rewards', 'Referrals', 'Abuse limits']);
    const keys = CREDIT_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key));
    expect(new Set(keys).size).toBe(13);
  });
});
