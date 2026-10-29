import { describe, expect, it } from 'vitest';
import {
  costRows,
  coverage,
  describeCoverage,
  describeLength,
  describePrice,
  describeRule,
  draftProblems,
  draftToRule,
  largestIncreasePct,
  previewPrices,
  priceBySecond,
  priceFor,
  ruleToDraft,
  SAMPLE_SECONDS,
  toNewRule,
  type PriceDraft,
  type RuleLike,
} from './pricing-format';

const draft = (overrides: Partial<PriceDraft> = {}): PriceDraft => ({
  mode: 'duration_tiers',
  perJob: '',
  rows: [{ upTo: '60', credits: '2' }],
  longer: '5',
  blockSeconds: '',
  blockCredits: '',
  minCredits: '',
  note: '',
  ...overrides,
});

const bySecond = (overrides: Partial<PriceDraft> = {}) =>
  draft({ mode: 'per_second', blockSeconds: '10', blockCredits: '1', minCredits: '2', ...overrides });

describe('by the second', () => {
  const rate = { blockSeconds: 10, blockCredits: 1, minCredits: 2 };

  it.each([
    [3, 2],
    [60, 6],
    [61, 7],
    [300, 30],
    [60 + 1e-9, 6],
  ])('prices %p seconds at %p credits, as the server does', (seconds, credits) => {
    expect(priceBySecond(seconds, rate)).toBe(credits);
  });

  it('summarises the rate and its minimum', () => {
    const rule = { version: 5, mode: 'per_second' as const, perJobCredits: null, tiers: null };
    expect(describeRule({ ...rule, blockSeconds: 10, blockCredits: 1, minCredits: 2 })).toBe(
      'v5 · 1 credit per 10 s · at least 2 credits',
    );
    expect(describeRule({ ...rule, blockSeconds: 60, blockCredits: 3, minCredits: null })).toBe(
      'v5 · 3 credits per 1 min',
    );
  });

  it('previews what typical clips would cost', () => {
    expect(previewPrices(bySecond())).toBe('30 s → 3 credits · 1 min → 6 · 5 min → 30');
    expect(previewPrices(bySecond({ blockSeconds: '' }))).toBeNull();
  });

  it.each([
    [{ blockSeconds: '0' }, 'Block length must be a whole number of seconds from 1 to 86,400.'],
    [{ blockCredits: '' }, 'Credits per block must be a whole number from 0 to 100,000.'],
    [{ minCredits: '1.5' }, 'The minimum must be empty or a whole number from 0 to 100,000.'],
  ])('flags %j', (overrides, problem) => {
    expect(draftProblems(bySecond(overrides))).toContain(problem);
  });

  it('accepts an empty minimum', () => {
    expect(draftProblems(bySecond({ minCredits: '' }))).toEqual([]);
  });

  it('sends the block rate, and the minimum only when given', () => {
    expect(toNewRule(bySecond())).toEqual({
      feature: 'auto_captions',
      mode: 'per_second',
      blockSeconds: 10,
      blockCredits: 1,
      minCredits: 2,
    });
    expect(toNewRule(bySecond({ minCredits: ' ' }))).toEqual({
      feature: 'auto_captions',
      mode: 'per_second',
      blockSeconds: 10,
      blockCredits: 1,
    });
  });
});

describe('describeLength', () => {
  it.each([
    [45, '45 s'],
    [60, '1 min'],
    [90, '1 min 30 s'],
    [300, '5 min'],
    [3600, '1 h'],
    [3725, '1 h 2 min 5 s'],
  ])('%i seconds reads %s', (seconds, text) => {
    expect(describeLength(seconds)).toBe(text);
  });
});

describe('describeRule', () => {
  it('summarises a per-job price', () => {
    expect(describeRule({ version: 2, mode: 'per_job', perJobCredits: 3, tiers: null })).toBe('v2 · 3 credits per job');
    expect(describeRule({ version: 2, mode: 'per_job', perJobCredits: 1, tiers: null })).toBe('v2 · 1 credit per job');
  });

  it('summarises tiers, naming the unit once', () => {
    expect(
      describeRule({
        version: 3,
        mode: 'duration_tiers',
        perJobCredits: null,
        tiers: [
          { upToSeconds: 60, credits: 2 },
          { upToSeconds: 300, credits: 5 },
          { upToSeconds: null, credits: 10 },
        ],
      }),
    ).toBe('v3 · up to 1 min → 2 credits · up to 5 min → 5 · longer → 10');
  });

  it('reads a single open-ended tier as one price for any length', () => {
    expect(
      describeRule({ version: 4, mode: 'duration_tiers', perJobCredits: null, tiers: [{ upToSeconds: null, credits: 7 }] }),
    ).toBe('v4 · 7 credits per job of any length');
  });
});

describe('draftProblems', () => {
  it('accepts a sensible tier list', () => {
    expect(draftProblems(draft({ rows: [{ upTo: '60', credits: '2' }, { upTo: '300', credits: '5' }] }))).toEqual([]);
  });

  it('wants each tier longer than the one before', () => {
    expect(draftProblems(draft({ rows: [{ upTo: '60', credits: '2' }, { upTo: '60', credits: '5' }] }))).toContain(
      'Band 2 must be longer than band 1.',
    );
  });

  it.each([
    [{ rows: [{ upTo: '0', credits: '2' }] }, 'Band 1: seconds must be a whole number from 1 to 86,400.'],
    [{ rows: [{ upTo: '60', credits: '-1' }] }, 'Band 1: credits must be a whole number from 0 to 100,000.'],
    [{ rows: [{ upTo: '60', credits: '1.5' }] }, 'Band 1: credits must be a whole number from 0 to 100,000.'],
    [{ longer: '' }, 'Anything longer: credits must be a whole number from 0 to 100,000.'],
    [{ mode: 'per_job' as const, perJob: '' }, 'Credits per job must be a whole number from 0 to 100,000.'],
  ])('flags %j', (overrides, problem) => {
    expect(draftProblems(draft(overrides))).toContain(problem);
  });

  it('allows at most 50 tiers in all', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ upTo: String(i + 1), credits: '1' }));
    expect(draftProblems(draft({ rows }))).toContain('At most 50 bands, counting "Anything longer".');
  });

  it('accepts a flat price made only of the open-ended tier', () => {
    expect(draftProblems(draft({ rows: [], longer: '7' }))).toEqual([]);
  });
});

describe('toNewRule', () => {
  it('ends a tier list with the open-ended tier and drops a blank note', () => {
    expect(toNewRule(draft())).toEqual({
      feature: 'auto_captions',
      mode: 'duration_tiers',
      tiers: [
        { upToSeconds: 60, credits: 2 },
        { upToSeconds: null, credits: 5 },
      ],
    });
  });

  it('sends only the open-ended tier when every row was removed', () => {
    expect(toNewRule(draft({ rows: [], longer: '7' })).tiers).toEqual([{ upToSeconds: null, credits: 7 }]);
  });

  it('sends a per-job price with its trimmed note', () => {
    expect(toNewRule(draft({ mode: 'per_job', perJob: '3', note: '  October  ' }))).toEqual({
      feature: 'auto_captions',
      mode: 'per_job',
      perJobCredits: 3,
      note: 'October',
    });
  });
});

const v3: RuleLike = { mode: 'per_second', blockSeconds: 30, blockCredits: 2, minCredits: 4, perJobCredits: null, tiers: null };
const v4: RuleLike = { ...v3, blockCredits: 3 };
const v2: RuleLike = {
  mode: 'duration_tiers',
  tiers: [
    { upToSeconds: 60, credits: 5 },
    { upToSeconds: 180, credits: 10 },
    { upToSeconds: null, credits: 20 },
  ],
  perJobCredits: null,
  blockSeconds: null,
  blockCredits: null,
  minCredits: null,
};
const v1: RuleLike = { mode: 'per_job', perJobCredits: 10, tiers: null, blockSeconds: null, blockCredits: null, minCredits: null };

describe('what a clip costs', () => {
  it('prices the six sample lengths by the second', () => {
    expect(SAMPLE_SECONDS.map((s) => priceFor(v3, s))).toEqual([4, 4, 4, 12, 20, 40]);
    expect(SAMPLE_SECONDS.map((s) => priceFor(v4, s))).toEqual([4, 4, 6, 18, 30, 60]);
  });

  it('prices by length band, each band including its own length', () => {
    expect([priceFor(v2, 60), priceFor(v2, 61), priceFor(v2, 600)]).toEqual([5, 10, 20]);
  });

  it('prices a flat price the same at any length', () => {
    expect([priceFor(v1, 1), priceFor(v1, 3600)]).toEqual([10, 10]);
  });
});

describe('what credits pay for', () => {
  it('finds the longest clip a number of credits covers', () => {
    expect([coverage(v3, 5), coverage(v4, 5), coverage(v3, 100), coverage(v3, 3)]).toEqual([60, 30, 1500, null]);
    expect([coverage(v2, 5), coverage(v2, 20), coverage(v1, 10), coverage(v1, 9)]).toEqual([60, Infinity, Infinity, null]);
  });

  it('covers any length when blocks are free above the minimum', () => {
    expect(coverage({ ...v3, blockCredits: 0 }, 4)).toBe(Infinity);
  });

  it('says it in words', () => {
    expect(describeCoverage(1500)).toBe('25 min');
    expect(describeCoverage(Infinity)).toBe('any length');
    expect(describeCoverage(null)).toBe('nothing');
  });
});

describe('describePrice', () => {
  it('says each kind of price as a plain sentence', () => {
    expect(describePrice(v3)).toBe('2 credits for every 30 seconds started · never less than 4 credits');
    expect(describePrice({ ...v3, minCredits: null })).toBe('2 credits for every 30 seconds started');
    expect(describePrice(v2)).toBe('5 credits up to 1 min · 10 up to 3 min · 20 for anything longer');
    expect(describePrice(v1)).toBe('10 credits per clip, any length');
  });

  it('names a block of one second and one credit in the singular', () => {
    expect(describePrice({ ...v3, blockSeconds: 1, blockCredits: 1, minCredits: null })).toBe('1 credit for every second started');
  });
});

describe('comparing two prices', () => {
  it('finds the largest rise as a percentage', () => {
    expect(largestIncreasePct(costRows(v3, v4))).toBe(50);
    expect(largestIncreasePct(costRows(v3, v3))).toBeNull();
    expect(largestIncreasePct(costRows(v4, v3))).toBeNull();
  });

  it('leaves Now empty when nothing is live, and New empty while the draft is invalid', () => {
    expect(costRows(null, v3)[0]).toEqual({ seconds: 15, now: null, next: 4 });
    expect(costRows(v3, null)[2]).toEqual({ seconds: 60, now: 4, next: null });
    expect(largestIncreasePct(costRows(null, v3))).toBeNull();
  });
});

describe('drafts from rules and back', () => {
  it('fills a draft from a live price, with no reason', () => {
    expect(ruleToDraft(v3)).toMatchObject({ mode: 'per_second', blockSeconds: '30', blockCredits: '2', minCredits: '4', note: '' });
    expect(ruleToDraft({ ...v3, minCredits: null }).minCredits).toBe('');
  });

  it('fills the bands and "anything longer" from a banded price', () => {
    expect(ruleToDraft(v2)).toMatchObject({
      mode: 'duration_tiers',
      rows: [
        { upTo: '60', credits: '5' },
        { upTo: '180', credits: '10' },
      ],
      longer: '20',
    });
  });

  it('starts empty, by time used, when there is no price', () => {
    expect(ruleToDraft(null)).toMatchObject({ mode: 'per_second', blockSeconds: '', blockCredits: '', minCredits: '', perJob: '' });
  });

  it('turns a valid draft back into a price, and an invalid one into nothing', () => {
    expect(draftToRule(ruleToDraft(v4))).toEqual(v4);
    expect(draftToRule(ruleToDraft(v2))).toEqual(v2);
    expect(draftToRule(ruleToDraft(v1))).toEqual(v1);
    expect(draftToRule({ ...ruleToDraft(v3), blockCredits: '' })).toBeNull();
  });
});
