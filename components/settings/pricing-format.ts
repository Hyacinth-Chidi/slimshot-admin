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

/** One line per version, e.g. `v3 · up to 1 min → 2 credits · up to 5 min → 5 · longer → 10`. */
export function describeRule(rule: Pick<PricingRule, 'version' | 'mode' | 'perJobCredits' | 'tiers'>): string {
  const version = `v${rule.version}`;
  if (rule.mode === 'per_job') return `${version} · ${credits(rule.perJobCredits ?? 0)} per job`;

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

  if (draft.rows.length + 1 > MAX_TIERS) problems.push(`At most ${MAX_TIERS} tiers, counting "Anything longer".`);
  let previous: number | null = null;
  draft.rows.forEach((row, i) => {
    const n = i + 1;
    const seconds = wholeIn(row.upTo, 1, MAX_SECONDS);
    if (seconds === null) {
      problems.push(`Tier ${n}: seconds must be a whole number from 1 to ${NUMBER.format(MAX_SECONDS)}.`);
    }
    if (wholeIn(row.credits, 0, MAX_CREDITS) === null) problems.push(creditsProblem(`Tier ${n}`));
    if (seconds !== null && previous !== null && seconds <= previous) {
      problems.push(`Tier ${n} must be longer than tier ${n - 1}.`);
    }
    if (seconds !== null) previous = seconds;
  });
  if (wholeIn(draft.longer, 0, MAX_CREDITS) === null) problems.push(creditsProblem('Anything longer'));
  return problems;
}

/** The request body. Call only when draftProblems is empty. */
export function toNewRule(draft: PriceDraft): NewPricingRule {
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
