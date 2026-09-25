import { describe, expect, it } from 'vitest';
import { filtersFromSearchParams, searchParamsFromFilters } from './filters-url';

describe('filtersFromSearchParams', () => {
  it('reads actorId, action and entityType', () => {
    const filters = filtersFromSearchParams(
      new URLSearchParams('actorId=a1&action=auth.login.succeeded&entityType=AdminUser'),
    );
    expect(filters).toEqual({
      actorId: 'a1',
      action: 'auth.login.succeeded',
      entityType: 'AdminUser',
    });
  });

  it('ignores cursor and limit — those are pagination state, not filters', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('cursor=abc&limit=5'));
    expect(filters).toEqual({});
  });

  it('returns an empty object for an empty URL', () => {
    expect(filtersFromSearchParams(new URLSearchParams(''))).toEqual({});
  });

  it('drops any param the server does not declare, so a stale/hand-edited URL cannot smuggle a 400 into the request', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('entityId=e1&bogus=x'));
    expect(filters).toEqual({});
  });
});

describe('searchParamsFromFilters', () => {
  it('round-trips a full filter set', () => {
    const original = { actorId: 'a1', action: 'auth.login.succeeded', entityType: 'AdminUser' };
    const params = searchParamsFromFilters(original);
    expect(filtersFromSearchParams(params)).toEqual(original);
  });

  it('omits empty/undefined filters', () => {
    const params = searchParamsFromFilters({ actorId: undefined, action: undefined });
    expect(params.toString()).toBe('');
  });
});
