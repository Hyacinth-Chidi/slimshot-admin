import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatShortDate } from './format';

describe('dates', () => {
  it('writes a day as "29 Oct 2026"', () => {
    expect(formatDate('2026-10-29T14:05:00Z', 'UTC')).toBe('29 Oct 2026');
  });

  it('writes a moment as "29 Oct 2026, 14:05"', () => {
    expect(formatDateTime('2026-10-29T14:05:00Z', 'UTC')).toBe('29 Oct 2026, 14:05');
  });

  it('writes a recent day as "27 Oct"', () => {
    expect(formatShortDate('2026-10-27T09:00:00Z', 'UTC')).toBe('27 Oct');
  });

  it('shows a dash for anything that is not a date', () => {
    expect(formatDate('not a date', 'UTC')).toBe('—');
    expect(formatDateTime('', 'UTC')).toBe('—');
    expect(formatShortDate('2026-13-45', 'UTC')).toBe('—');
  });

  it('uses the time zone it is given', () => {
    // 23:30 UTC is already the next day in Lagos (UTC+1).
    expect(formatDate('2026-10-29T23:30:00Z', 'Africa/Lagos')).toBe('30 Oct 2026');
  });
});
