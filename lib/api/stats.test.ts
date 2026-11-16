import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from '@/lib/api/client';
import { fetchUserStats, tileCounts, zeroFill } from './stats';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/lib/auth/session', () => ({ withRefresh: (fn: () => unknown) => fn() }));

afterEach(() => {
  vi.resetAllMocks();
});

describe('fetchUserStats', () => {
  it('asks how many users there are, and how many joined in the window', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ total: 1284, newInPeriod: 56 });
    await expect(fetchUserStats(7)).resolves.toEqual({ total: 1284, newInPeriod: 56 });
    expect(client.apiFetch).toHaveBeenCalledWith('/stats/users?days=7');
  });
});

describe('tileCounts', () => {
  it('reads the library figures the cards show', () => {
    expect(
      tileCounts({
        totalAssets: 74,
        failedCount: 2,
        totalBytes: 19_000_000,
        byStatus: { published: 70, processing: 2 },
        byKind: {},
      }),
    ).toEqual({ total: 74, published: 70, failed: 2 });
  });
});

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
