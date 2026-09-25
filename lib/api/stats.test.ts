import { describe, expect, it } from 'vitest';
import { sparklinePoints, type UploadPoint } from './stats';

function filled(counts: number[]): UploadPoint[] {
  return counts.map((count, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, count }));
}

describe('sparklinePoints', () => {
  it('returns an empty array when every zero-filled point is zero', () => {
    // A new install or a quiet month zero-fills to an all-zero series. Feeding
    // that straight to the Sparkline draws a flat line at 0, which reads as a
    // broken chart rather than "nothing happened yet."
    expect(sparklinePoints(filled([0, 0, 0, 0]))).toEqual([]);
  });

  it('returns the counts when at least one day has uploads', () => {
    expect(sparklinePoints(filled([0, 2, 0, 5]))).toEqual([0, 2, 0, 5]);
  });

  it('returns the counts when every day has uploads', () => {
    expect(sparklinePoints(filled([1, 1, 1]))).toEqual([1, 1, 1]);
  });
});
