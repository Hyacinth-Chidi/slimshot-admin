import { describe, expect, it } from 'vitest';
import { filtersFromSearchParams, searchParamsFromFilters } from './filters-url';

describe('filtersFromSearchParams', () => {
  it('reads categoryId from the URL, for the "view blocking assets" link', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('categoryId=c1'));
    expect(filters.categoryId).toBe('c1');
  });

  it('reads status only when it is a known AssetStatus', () => {
    expect(filtersFromSearchParams(new URLSearchParams('status=published')).status).toBe(
      'published',
    );
    expect(filtersFromSearchParams(new URLSearchParams('status=bogus')).status).toBeUndefined();
  });

  it('reads kind and search', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('kind=audio&search=rain'));
    expect(filters.kind).toBe('audio');
    expect(filters.search).toBe('rain');
  });

  it('ignores cursor and limit — those are pagination state, not filters', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('cursor=abc&limit=5'));
    expect(filters).toEqual({});
  });

  it('returns an empty object for an empty URL', () => {
    expect(filtersFromSearchParams(new URLSearchParams(''))).toEqual({});
  });
});

describe('searchParamsFromFilters', () => {
  it('round-trips categoryId back into the URL', () => {
    const params = searchParamsFromFilters({ categoryId: 'c1' });
    expect(params.get('categoryId')).toBe('c1');
  });

  it('omits empty/undefined filters', () => {
    const params = searchParamsFromFilters({ kind: undefined, status: undefined });
    expect(params.toString()).toBe('');
  });

  it('round-trips a full filter set', () => {
    const original = { kind: 'audio', status: 'published' as const, categoryId: 'c1', search: 'rain' };
    const params = searchParamsFromFilters(original);
    expect(filtersFromSearchParams(params)).toEqual(original);
  });
});
