import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config';

describe('old dashboard addresses', () => {
  it('redirect to where each page lives now, keeping bookmarks working', async () => {
    const redirects = await nextConfig.redirects!();
    const map = Object.fromEntries(redirects.map((r) => [r.source, r.destination]));
    expect(map).toEqual({
      '/assets': '/audio',
      '/assets/:id': '/audio/:id',
      '/categories': '/audio/categories',
      '/settings': '/system/providers',
      '/audit': '/system/audit',
      // Credits left System for its own sidebar group.
      '/system/credits': '/credits/pricing',
    });
    // Temporary: the old addresses may be reused one day.
    expect(redirects.every((r) => r.permanent === false)).toBe(true);
  });
});
