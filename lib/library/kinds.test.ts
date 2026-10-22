import { describe, expect, it } from 'vitest';
import { assetHref, librarySection } from './kinds';

describe('library kinds', () => {
  it('gives each kind its section in the Library', () => {
    expect(librarySection('audio')).toMatchObject({
      kind: 'audio',
      label: 'Audio',
      href: '/audio',
      noun: { one: 'sound', many: 'sounds' },
    });
    expect(librarySection('font')).toMatchObject({ kind: 'font', label: 'Fonts', href: '/fonts' });
  });

  it('tells the owner to create Trending, the one category the app lists fonts from', () => {
    expect(librarySection('font')?.appRoots).toEqual([{ slug: 'trending', name: 'Trending' }]);
  });

  it('has no section for a kind the dashboard has no pages for', () => {
    expect(librarySection('template')).toBeUndefined();
  });

  it("links an asset to its kind's page", () => {
    expect(assetHref('audio', 'a1')).toBe('/audio/a1');
    expect(assetHref('font', 'f 1')).toBe('/fonts/f%201');
  });
});
