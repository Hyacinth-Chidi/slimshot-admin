import { describe, expect, it } from 'vitest';
import { canManageCredits, canManageUsers } from './permissions';

describe('role rules', () => {
  it.each([
    ['owner', true, true],
    ['admin', true, false],
    ['editor', false, false],
    ['viewer', false, false],
    [undefined, false, false],
  ] as const)('%s: manage users %s, manage credits %s', (role, users, credits) => {
    expect(canManageUsers(role)).toBe(users);
    expect(canManageCredits(role)).toBe(credits);
  });
});
