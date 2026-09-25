import { describe, expect, it } from 'vitest';
import { formatAuditTimestamp, shortId } from './format';

describe('formatAuditTimestamp', () => {
  it('formats an ISO date string as an absolute, readable timestamp', () => {
    const formatted = formatAuditTimestamp('2026-09-23T15:28:37.268Z');
    expect(formatted).toMatch(/2026/);
  });

  it('returns an em dash for an invalid date string', () => {
    expect(formatAuditTimestamp('not-a-date')).toBe('—');
  });
});

describe('shortId', () => {
  it('returns an em dash for null', () => {
    expect(shortId(null)).toBe('—');
  });

  it('leaves short ids untouched', () => {
    expect(shortId('abc123')).toBe('abc123');
  });

  it('shortens a long id to a recognisable prefix/suffix', () => {
    const long = 'cmue7d44p0000dsulkoy9vmk6';
    const result = shortId(long);
    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain('…');
    expect(result.startsWith(long.slice(0, 6))).toBe(true);
    expect(result.endsWith(long.slice(-4))).toBe(true);
  });
});
