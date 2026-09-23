import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });

  it('lets a later tailwind class win over an earlier conflicting one', () => {
    // Without tailwind-merge this returns "p-2 p-4" and both are emitted,
    // which is how a conditional override silently fails to apply.
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
