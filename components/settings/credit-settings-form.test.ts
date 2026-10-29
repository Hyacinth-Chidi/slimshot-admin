import { describe, expect, it } from 'vitest';
import { normalizeDomains, parseField } from './credit-settings-form';

describe('normalizeDomains', () => {
  it('splits on lines, commas and spaces, lowercases, drops blanks and duplicates', () => {
    expect(normalizeDomains('Mailinator.com, foo.com\n\nfoo.com  BAR.io')).toEqual([
      'mailinator.com',
      'foo.com',
      'bar.io',
    ]);
  });
});

describe('parseField', () => {
  const field = { key: 'adDailyCap' as const, label: 'Ads per day', min: 0, max: 1_000 };

  it('reads a whole number within the bounds', () => {
    expect(parseField(field, ' 10 ')).toBe(10);
    expect(parseField(field, '0')).toBe(0);
  });

  it('refuses anything else', () => {
    for (const raw of ['', '1.5', '-1', '1001', 'ten']) expect(parseField(field, raw)).toBeNull();
  });
});
