import { describe, expect, it } from 'vitest';
import { describeLength, describeRule, draftProblems, toNewRule, type PriceDraft } from './pricing-format';

const draft = (overrides: Partial<PriceDraft> = {}): PriceDraft => ({
  mode: 'duration_tiers',
  perJob: '',
  rows: [{ upTo: '60', credits: '2' }],
  longer: '5',
  note: '',
  ...overrides,
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
      'Tier 2 must be longer than tier 1.',
    );
  });

  it.each([
    [{ rows: [{ upTo: '0', credits: '2' }] }, 'Tier 1: seconds must be a whole number from 1 to 86,400.'],
    [{ rows: [{ upTo: '60', credits: '-1' }] }, 'Tier 1: credits must be a whole number from 0 to 100,000.'],
    [{ rows: [{ upTo: '60', credits: '1.5' }] }, 'Tier 1: credits must be a whole number from 0 to 100,000.'],
    [{ longer: '' }, 'Anything longer: credits must be a whole number from 0 to 100,000.'],
    [{ mode: 'per_job' as const, perJob: '' }, 'Credits per job must be a whole number from 0 to 100,000.'],
  ])('flags %j', (overrides, problem) => {
    expect(draftProblems(draft(overrides))).toContain(problem);
  });

  it('allows at most 50 tiers in all', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ upTo: String(i + 1), credits: '1' }));
    expect(draftProblems(draft({ rows }))).toContain('At most 50 tiers, counting "Anything longer".');
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
