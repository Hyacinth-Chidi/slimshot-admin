import { describe, expect, it } from 'vitest';
import { formatCreatedDate, formatDuration } from './format';

describe('formatDuration', () => {
  it('formats whole minutes as m:ss', () => {
    expect(formatDuration(65_000)).toBe('1:05');
  });

  it('pads seconds under 10', () => {
    expect(formatDuration(9_000)).toBe('0:09');
  });

  it('rounds to the nearest second', () => {
    expect(formatDuration(59_600)).toBe('1:00');
  });

  it('returns an em dash for null', () => {
    expect(formatDuration(null)).toBe('—');
  });

  it('handles durations over an hour without an hours place', () => {
    expect(formatDuration(3_661_000)).toBe('61:01');
  });
});

describe('formatCreatedDate', () => {
  it('formats an ISO date string', () => {
    expect(formatCreatedDate('2026-09-20T10:00:00Z')).toMatch(/2026/);
  });

  it('returns an em dash for null', () => {
    expect(formatCreatedDate(null)).toBe('—');
  });

  it('returns an em dash for an invalid date string', () => {
    expect(formatCreatedDate('not-a-date')).toBe('—');
  });
});
