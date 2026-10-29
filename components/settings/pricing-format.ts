import type { NewPricingRule, PricingMode, PricingRule } from '@/lib/api/credits';

const NUMBER = new Intl.NumberFormat('en-GB');

/** The server's limits (CreatePricingRuleDto and tierProblems). */
export const MAX_SECONDS = 86_400;
export const MAX_CREDITS = 100_000;
export const MAX_TIERS = 50;

/** `45 s`, `1 min`, `1 min 30 s`, `1 h 2 min 5 s`: zero parts left out. */
export function describeLength(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours && `${hours} h`, minutes && `${minutes} min`, rest && `${rest} s`].filter(Boolean).join(' ');
}

function credits(n: number): string {
  return `${NUMBER.format(n)} ${n === 1 ? 'credit' : 'credits'}`;
}

export interface BlockRate {
  blockSeconds: number;
  blockCredits: number;
  minCredits: number | null;
}

/**
 * The server's by-the-second formula (pricing.ts priceFor), for the dialog's
 * preview: started blocks × credits, never below the minimum, the length
 * rounded to the millisecond first.
 */
export function priceBySecond(seconds: number, rate: BlockRate): number {
  const blocks = Math.max(1, Math.ceil(Math.round(seconds * 1000) / (rate.blockSeconds * 1000)));
  return Math.max(rate.minCredits ?? 0, blocks * rate.blockCredits);
}

/**
 * One line per version, e.g. `v3 · up to 1 min → 2 credits · up to 5 min → 5 · longer → 10`
 * or `v5 · 1 credit per 10 s · at least 2 credits`.
 */
export function describeRule(
  rule: Pick<PricingRule, 'version' | 'mode' | 'perJobCredits' | 'tiers'> &
    Partial<Pick<PricingRule, 'blockSeconds' | 'blockCredits' | 'minCredits'>>,
): string {
  const version = `v${rule.version}`;
  if (rule.mode === 'per_job') return `${version} · ${credits(rule.perJobCredits ?? 0)} per job`;
  if (rule.mode === 'per_second') {
    const rate = `${credits(rule.blockCredits ?? 0)} per ${describeLength(rule.blockSeconds ?? 0)}`;
    return rule.minCredits ? `${version} · ${rate} · at least ${credits(rule.minCredits)}` : `${version} · ${rate}`;
  }

  const tiers = rule.tiers ?? [];
  if (tiers.length === 1 && tiers[0].upToSeconds === null) {
    return `${version} · ${credits(tiers[0].credits)} per job of any length`;
  }
  const parts = tiers.map((tier, i) => {
    // The unit is named once, on the first tier; the rest read as the same unit.
    const amount = i === 0 ? credits(tier.credits) : NUMBER.format(tier.credits);
    return tier.upToSeconds === null
      ? `longer → ${amount}`
      : `up to ${describeLength(tier.upToSeconds)} → ${amount}`;
  });
  return [version, ...parts].join(' · ');
}

/** What the new-price dialog holds while being edited: raw text, so a half-typed number is not lost. */
export interface PriceDraft {
  mode: PricingMode;
  perJob: string;
  rows: Array<{ upTo: string; credits: string }>;
  /** Credits for the fixed last tier, "Anything longer" (upToSeconds: null). */
  longer: string;
  /** By the second: credits per started block of blockSeconds, never below minCredits (optional). */
  blockSeconds: string;
  blockCredits: string;
  minCredits: string;
  note: string;
}

function wholeIn(raw: string, min: number, max: number): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= min && value <= max ? value : null;
}

const creditsProblem = (who: string) =>
  `${who}: credits must be a whole number from 0 to ${NUMBER.format(MAX_CREDITS)}.`;

/** Mirrors the server's checks, so a bad price is explained before it is sent. Empty means valid. */
export function draftProblems(draft: PriceDraft): string[] {
  const problems: string[] = [];
  if (draft.mode === 'per_job') {
    if (wholeIn(draft.perJob, 0, MAX_CREDITS) === null) {
      problems.push(`Credits per job must be a whole number from 0 to ${NUMBER.format(MAX_CREDITS)}.`);
    }
    return problems;
  }

  if (draft.mode === 'per_second') {
    if (wholeIn(draft.blockSeconds, 1, MAX_SECONDS) === null) {
      problems.push(`Block length must be a whole number of seconds from 1 to ${NUMBER.format(MAX_SECONDS)}.`);
    }
    if (wholeIn(draft.blockCredits, 0, MAX_CREDITS) === null) {
      problems.push(`Credits per block must be a whole number from 0 to ${NUMBER.format(MAX_CREDITS)}.`);
    }
    if (draft.minCredits.trim() !== '' && wholeIn(draft.minCredits, 0, MAX_CREDITS) === null) {
      problems.push(`The minimum must be empty or a whole number from 0 to ${NUMBER.format(MAX_CREDITS)}.`);
    }
    return problems;
  }

  if (draft.rows.length + 1 > MAX_TIERS) problems.push(`At most ${MAX_TIERS} bands, counting "Anything longer".`);
  let previous: number | null = null;
  draft.rows.forEach((row, i) => {
    const n = i + 1;
    const seconds = wholeIn(row.upTo, 1, MAX_SECONDS);
    if (seconds === null) {
      problems.push(`Band ${n}: seconds must be a whole number from 1 to ${NUMBER.format(MAX_SECONDS)}.`);
    }
    if (wholeIn(row.credits, 0, MAX_CREDITS) === null) problems.push(creditsProblem(`Band ${n}`));
    if (seconds !== null && previous !== null && seconds <= previous) {
      problems.push(`Band ${n} must be longer than band ${n - 1}.`);
    }
    if (seconds !== null) previous = seconds;
  });
  if (wholeIn(draft.longer, 0, MAX_CREDITS) === null) problems.push(creditsProblem('Anything longer'));
  return problems;
}

function blockRate(draft: PriceDraft): BlockRate {
  const min = draft.minCredits.trim();
  return {
    blockSeconds: Number(draft.blockSeconds.trim()),
    blockCredits: Number(draft.blockCredits.trim()),
    minCredits: min === '' ? null : Number(min),
  };
}

const PREVIEW_SECONDS = [30, 60, 300];

/** `30 s → 3 credits · 1 min → 6 · 5 min → 30`, or null until the rate is valid. */
export function previewPrices(draft: PriceDraft): string | null {
  if (draft.mode !== 'per_second' || draftProblems(draft).length > 0) return null;
  const rate = blockRate(draft);
  return PREVIEW_SECONDS.map((seconds, i) => {
    const price = priceBySecond(seconds, rate);
    return `${describeLength(seconds)} → ${i === 0 ? credits(price) : NUMBER.format(price)}`;
  }).join(' · ');
}

/** The request body. Call only when draftProblems is empty. */
export function toNewRule(draft: PriceDraft): NewPricingRule {
  if (draft.mode === 'per_second') {
    const { minCredits, ...rate } = blockRate(draft);
    const rule: NewPricingRule = {
      feature: 'auto_captions',
      mode: 'per_second',
      ...rate,
      ...(minCredits === null ? {} : { minCredits }),
    };
    const note = draft.note.trim();
    if (note) rule.note = note;
    return rule;
  }
  const rule: NewPricingRule =
    draft.mode === 'per_job'
      ? { feature: 'auto_captions', mode: 'per_job', perJobCredits: Number(draft.perJob.trim()) }
      : {
          feature: 'auto_captions',
          mode: 'duration_tiers',
          tiers: [
            ...draft.rows.map((row) => ({ upToSeconds: Number(row.upTo.trim()), credits: Number(row.credits.trim()) })),
            { upToSeconds: null, credits: Number(draft.longer.trim()) },
          ],
        };
  const note = draft.note.trim();
  if (note) rule.note = note;
  return rule;
}

/** The parts of a pricing rule that set what a clip costs. */
export type RuleLike = Pick<PricingRule, 'mode' | 'perJobCredits' | 'tiers' | 'blockSeconds' | 'blockCredits' | 'minCredits'>;

/** The clip lengths the dashboard prices to show what a rule means: 15 s, 30 s, 1, 3, 5 and 10 min. */
export const SAMPLE_SECONDS = [15, 30, 60, 180, 300, 600] as const;

/** What a clip of this length costs: the server's priceFor (pricing.ts), band bounds included. */
export function priceFor(rule: RuleLike, seconds: number): number {
  if (rule.mode === 'per_job') return rule.perJobCredits ?? 0;
  if (rule.mode === 'per_second') {
    return priceBySecond(seconds, {
      blockSeconds: rule.blockSeconds ?? 0,
      blockCredits: rule.blockCredits ?? 0,
      minCredits: rule.minCredits,
    });
  }
  const band = (rule.tiers ?? []).find((t) => t.upToSeconds === null || seconds <= t.upToSeconds);
  return band?.credits ?? 0;
}

/**
 * The longest clip, in seconds, that `credits` pays for: Infinity when every
 * length is affordable, null when none is.
 */
export function coverage(rule: RuleLike, credits: number): number | null {
  if (rule.mode === 'per_job') return (rule.perJobCredits ?? 0) <= credits ? Infinity : null;
  if (rule.mode === 'per_second') {
    const blockCredits = rule.blockCredits ?? 0;
    if ((rule.minCredits ?? 0) > credits || blockCredits > credits) return null;
    if (blockCredits === 0) return Infinity;
    return Math.floor(credits / blockCredits) * (rule.blockSeconds ?? 0);
  }
  let longest: number | null = null;
  for (const band of rule.tiers ?? []) {
    if (band.credits > credits) continue;
    if (band.upToSeconds === null) return Infinity;
    longest = Math.max(longest ?? 0, band.upToSeconds);
  }
  return longest;
}

/** "25 min", "any length", "nothing". */
export function describeCoverage(seconds: number | null): string {
  if (seconds === null) return 'nothing';
  if (seconds === Infinity) return 'any length';
  return describeLength(seconds);
}

/** A block length said in a sentence: "30 seconds", "second", "1 min 30 s". */
function blockLength(seconds: number): string {
  if (seconds === 1) return 'second';
  return seconds < 60 ? `${seconds} seconds` : describeLength(seconds);
}

/** The price as one plain sentence, for the owner rather than for the server. */
export function describePrice(rule: RuleLike): string {
  if (rule.mode === 'per_job') return `${credits(rule.perJobCredits ?? 0)} per clip, any length`;
  if (rule.mode === 'per_second') {
    const rate = `${credits(rule.blockCredits ?? 0)} for every ${blockLength(rule.blockSeconds ?? 0)} started`;
    return rule.minCredits ? `${rate} · never less than ${credits(rule.minCredits)}` : rate;
  }
  const bands = rule.tiers ?? [];
  if (bands.length === 1 && bands[0].upToSeconds === null) return `${credits(bands[0].credits)} per clip, any length`;
  return bands
    .map((band, i) => {
      // The unit is named once, on the first band.
      const amount = i === 0 ? credits(band.credits) : NUMBER.format(band.credits);
      return band.upToSeconds === null
        ? `${amount} for anything longer`
        : `${amount} up to ${describeLength(band.upToSeconds)}`;
    })
    .join(' · ');
}

const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

/** A draft filled from a price (or empty, by time used, when there is none). The reason always starts empty. */
export function ruleToDraft(rule: RuleLike | null): PriceDraft {
  const empty: PriceDraft = {
    mode: 'per_second',
    perJob: '',
    rows: [{ upTo: '', credits: '' }],
    longer: '',
    blockSeconds: '',
    blockCredits: '',
    minCredits: '',
    note: '',
  };
  if (!rule) return empty;
  if (rule.mode === 'per_job') return { ...empty, mode: 'per_job', perJob: text(rule.perJobCredits) };
  if (rule.mode === 'per_second') {
    return {
      ...empty,
      mode: 'per_second',
      blockSeconds: text(rule.blockSeconds),
      blockCredits: text(rule.blockCredits),
      minCredits: text(rule.minCredits),
    };
  }
  const bands = rule.tiers ?? [];
  const open = bands.find((b) => b.upToSeconds === null);
  return {
    ...empty,
    mode: 'duration_tiers',
    rows: bands.filter((b) => b.upToSeconds !== null).map((b) => ({ upTo: text(b.upToSeconds), credits: text(b.credits) })),
    longer: text(open?.credits),
  };
}

/** The price a draft describes, or null while it has problems. */
export function draftToRule(draft: PriceDraft): RuleLike | null {
  if (draftProblems(draft).length > 0) return null;
  const rule = toNewRule(draft);
  return {
    mode: rule.mode,
    perJobCredits: rule.perJobCredits ?? null,
    tiers: rule.tiers ?? null,
    blockSeconds: rule.blockSeconds ?? null,
    blockCredits: rule.blockCredits ?? null,
    minCredits: rule.minCredits ?? null,
  };
}

export interface CostRow {
  seconds: number;
  now: number | null;
  next: number | null;
}

/** Each sample length priced now and under the new price; a missing price leaves its column empty. */
export function costRows(now: RuleLike | null, next: RuleLike | null): CostRow[] {
  return SAMPLE_SECONDS.map((seconds) => ({
    seconds,
    now: now ? priceFor(now, seconds) : null,
    next: next ? priceFor(next, seconds) : null,
  }));
}

/** The biggest rise among the rows, as a whole percentage; null when nothing costs more. */
export function largestIncreasePct(rows: CostRow[]): number | null {
  let largest: number | null = null;
  for (const { now, next } of rows) {
    if (now === null || next === null || now <= 0 || next <= now) continue;
    const pct = Math.round(((next - now) / now) * 100);
    largest = Math.max(largest ?? 0, pct);
  }
  return largest;
}
