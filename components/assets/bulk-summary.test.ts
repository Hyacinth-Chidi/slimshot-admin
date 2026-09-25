import { describe, expect, it } from 'vitest';
import { summarizeBulkResult } from './bulk-summary';

describe('summarizeBulkResult', () => {
  it('reports a clean success', () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
    ];
    expect(summarizeBulkResult('published', results)).toBe('3 published.');
  });

  it('reports a mix of success and failure with the first error message', () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: new Error('cannot be published from status "draft"') },
    ];
    expect(summarizeBulkResult('published', results)).toBe(
      '3 published, 1 failed: cannot be published from status "draft"',
    );
  });

  it('counts multiple failures but surfaces only the first message', () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: new Error('first error') },
      { status: 'rejected', reason: new Error('second error') },
    ];
    expect(summarizeBulkResult('deleted', results)).toBe('1 deleted, 2 failed: first error');
  });

  it('handles a non-Error rejection reason', () => {
    const results: PromiseSettledResult<unknown>[] = [{ status: 'rejected', reason: 'boom' }];
    expect(summarizeBulkResult('unpublished', results)).toBe('0 unpublished, 1 failed: boom');
  });
});
