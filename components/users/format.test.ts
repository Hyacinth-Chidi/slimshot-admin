import { describe, expect, it } from 'vitest';
import { displayName, formatCredits, formatSigned, userHref } from './format';

describe('user formatting', () => {
  it('signs amounts with a real minus sign', () => {
    expect(formatSigned(-12)).toBe('−12');
    expect(formatSigned(5)).toBe('+5');
    expect(formatSigned(0)).toBe('0');
    expect(formatSigned(-1500)).toBe('−1,500');
  });

  it('groups digits in balances', () => {
    expect(formatCredits(1234567)).toBe('1,234,567');
  });

  it('names a user who has not picked a username yet', () => {
    expect(displayName({ username: null })).toBe('Not claimed yet');
    expect(displayName({ username: 'ann' })).toBe('ann');
  });

  it("links to a user's page, carrying an active search", () => {
    expect(userHref('u1')).toBe('/users/u1');
    expect(userHref('u1', 'ann lee')).toBe('/users/u1?q=ann+lee');
    expect(userHref('a/b')).toBe('/users/a%2Fb');
  });
});
