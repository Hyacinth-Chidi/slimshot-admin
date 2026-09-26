import { describe, expect, it } from 'vitest';
import { zeroFill } from './stats';

describe('zeroFill', () => {
  it('pads missing days with zero', () => {
    const today = new Date('2026-09-23T00:00:00Z');
    const filled = zeroFill([{ date: '2026-09-23', count: 5 }], 3, today);
    expect(filled).toEqual([
      { date: '2026-09-21', count: 0 },
      { date: '2026-09-22', count: 0 },
      { date: '2026-09-23', count: 5 },
    ]);
  });

  it('returns all zeroes for an empty series', () => {
    // A new install has no uploads; the chart draws a month of silence.
    const filled = zeroFill([], 7, new Date('2026-09-23T00:00:00Z'));
    expect(filled).toHaveLength(7);
    expect(filled.every((p) => p.count === 0)).toBe(true);
  });

  it('ends on today and keeps the days in order', () => {
    const filled = zeroFill([], 30, new Date('2026-09-26T12:00:00Z'));
    expect(filled[0].date).toBe('2026-08-28');
    expect(filled[29].date).toBe('2026-09-26');
  });
});
