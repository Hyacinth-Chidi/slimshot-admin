import { describe, expect, it } from 'vitest';
import { EARNING_CARDS, SIGN_IN_CODES_CARD } from './setting-cards';

const NUMERIC_SETTINGS = [
  'signupBonusCredits',
  'adRewardCredits',
  'adDailyCap',
  'referralInviterCredits',
  'referralInviteeCredits',
  'referralCapCount',
  'referralCapDays',
  'ipSignupLimitPer24h',
  'otpMaxAttempts',
  'otpResendCooldownSeconds',
  'otpPerEmailPerHour',
  'otpPerDevicePerHour',
  'otpPerIpPerHour',
];

describe('setting cards', () => {
  it('put every numeric credit setting on exactly one card', () => {
    const keys = [...EARNING_CARDS, SIGN_IN_CODES_CARD].flatMap((card) =>
      card.sentences.flat().flatMap((part) => (typeof part === 'string' ? [] : [part.key])),
    );
    expect([...keys].sort()).toEqual([...NUMERIC_SETTINGS].sort());
  });

  it("use the server's bounds", () => {
    const parts = [...EARNING_CARDS, SIGN_IN_CODES_CARD].flatMap((card) =>
      card.sentences.flat().filter((p) => typeof p !== 'string'),
    );
    const bounds = Object.fromEntries(parts.map((p) => [p.key, [p.min, p.max]]));
    expect(bounds).toMatchObject({
      adDailyCap: [0, 1_000],
      referralCapDays: [1, 365],
      otpMaxAttempts: [1, 20],
      otpResendCooldownSeconds: [0, 3_600],
      ipSignupLimitPer24h: [1, 100_000],
    });
  });
});
