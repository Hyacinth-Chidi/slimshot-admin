import type { CreditSettingsPatch } from '@/lib/api/credits';

/** The settings that take any number (not the domain list, switches, or fixed choices like 1, 7 or 30). */
export type NumericSettingKey = {
  [K in keyof CreditSettingsPatch]-?: number extends NonNullable<CreditSettingsPatch[K]> ? K : never;
}[keyof CreditSettingsPatch];

export interface CreditField {
  key: NumericSettingKey;
  label: string;
  min: number;
  max: number;
}

/** One lowercase domain per entry, in first-seen order: how the server stores and compares them. */
export function normalizeDomains(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[\s,]+/)) {
    const domain = part.trim().toLowerCase();
    if (domain) seen.add(domain);
  }
  return [...seen];
}

/** A whole number within the field's bounds, or null. */
export function parseField(field: CreditField, raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= field.min && value <= field.max ? value : null;
}
