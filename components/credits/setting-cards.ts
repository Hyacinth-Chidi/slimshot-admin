import { Clapperboard, KeyRound, PartyPopper, UserPlus, type LucideIcon } from 'lucide-react';
import { coverage, type RuleLike } from '@/components/settings/pricing-format';
import { describeCoverage } from '@/components/settings/pricing-format';
import type { NumericSettingKey } from '@/components/settings/credit-settings-form';

/** Text, or an inline number input for one setting with the server's bounds (UpdateCreditSettingsDto). */
export type SentencePart = string | { key: NumericSettingKey; label: string; min: number; max: number };

export interface HintContext {
  /** The card's values as typed, where they are valid numbers. */
  values: Partial<Record<NumericSettingKey, number>>;
  /** The live caption price, if there is one. */
  live: RuleLike | null;
}

export interface SettingCardSpec {
  id: string;
  title: string;
  icon: LucideIcon;
  sentences: SentencePart[][];
  /** A line under the first sentence, worked out from the values. */
  hint?: (ctx: HintContext) => string | null;
}

const NUMBER = new Intl.NumberFormat('en-GB');

/** The free credits users get: Credits › Rewards (spec §7.3). */
export const REWARD_CARDS: SettingCardSpec[] = [
  {
    id: 'signup',
    title: 'Sign-up bonus',
    icon: PartyPopper,
    sentences: [
      ['New accounts get', { key: 'signupBonusCredits', label: 'Sign-up bonus credits', min: 0, max: 100_000 }, 'credits when they pick a username.'],
      [
        'Only the first',
        { key: 'ipSignupLimitPer24h', label: 'New accounts per network per day', min: 1, max: 100_000 },
        'new accounts from one network in 24 hours get the bonus.',
      ],
    ],
    hint: ({ values, live }) => {
      const bonus = values.signupBonusCredits;
      if (!live || bonus === undefined) return null;
      const covers = coverage(live, bonus);
      if (covers === Infinity) return "Enough for captions of any length at today's price.";
      if (covers === null) return "Not enough for a caption job at today's price.";
      return `≈ ${describeCoverage(covers)} of captions at today's price.`;
    },
  },
  {
    id: 'ads',
    title: 'Rewarded ads',
    icon: Clapperboard,
    sentences: [
      [
        'Each ad watched gives',
        { key: 'adRewardCredits', label: 'Credits per ad', min: 0, max: 100_000 },
        'credits, up to',
        { key: 'adDailyCap', label: 'Ads per day', min: 0, max: 1_000 },
        'ads per user a day.',
      ],
    ],
    hint: ({ values }) => {
      const { adRewardCredits: reward, adDailyCap: cap } = values;
      if (reward === undefined || cap === undefined) return null;
      return `Up to ${NUMBER.format(reward * cap)} credits a day per user.`;
    },
  },
  {
    id: 'referrals',
    title: 'Referrals',
    icon: UserPlus,
    sentences: [
      [
        'When a friend joins with a code, the inviter gets',
        { key: 'referralInviterCredits', label: 'Inviter credits', min: 0, max: 100_000 },
        'and the friend gets',
        { key: 'referralInviteeCredits', label: 'Friend credits', min: 0, max: 100_000 },
        'credits.',
      ],
      [
        'Each inviter is rewarded for up to',
        { key: 'referralCapCount', label: 'Rewarded friends per inviter', min: 0, max: 10_000 },
        'friends every',
        { key: 'referralCapDays', label: 'Days per referral limit', min: 1, max: 365 },
        'days.',
      ],
    ],
  },
];

/** Limits on email sign-in codes (spec §7.4). */
export const SIGN_IN_CODES_CARD: SettingCardSpec = {
  id: 'codes',
  title: 'Sign-in codes',
  icon: KeyRound,
  sentences: [
    [
      'A code allows',
      { key: 'otpMaxAttempts', label: 'Wrong tries per code', min: 1, max: 20 },
      'wrong tries. Users wait',
      { key: 'otpResendCooldownSeconds', label: 'Seconds between codes', min: 0, max: 3_600 },
      'seconds before asking for another.',
    ],
    [
      'Each hour, at most',
      { key: 'otpPerEmailPerHour', label: 'Codes per email per hour', min: 1, max: 10_000 },
      'codes per email,',
      { key: 'otpPerDevicePerHour', label: 'Codes per phone per hour', min: 1, max: 10_000 },
      'per phone and',
      { key: 'otpPerIpPerHour', label: 'Codes per network per hour', min: 1, max: 10_000 },
      'per network.',
    ],
  ],
};
