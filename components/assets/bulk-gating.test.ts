import { describe, expect, it } from 'vitest';
import { bulkCanPublish, bulkCanUnpublish } from './bulk-gating';

describe('bulkCanPublish', () => {
  it('is true when unfiltered — the server\'s own transition check is the backstop', () => {
    expect(bulkCanPublish(undefined)).toBe(true);
  });

  it('is true when filtered to ready or archived', () => {
    expect(bulkCanPublish('ready')).toBe(true);
    expect(bulkCanPublish('archived')).toBe(true);
  });

  it('is false when filtered to a status that can never be published in bulk correctly', () => {
    expect(bulkCanPublish('draft')).toBe(false);
    expect(bulkCanPublish('processing')).toBe(false);
    expect(bulkCanPublish('published')).toBe(false);
    expect(bulkCanPublish('failed')).toBe(false);
  });
});

describe('bulkCanUnpublish', () => {
  it('is true only when the filter is exactly published — every visible row is genuinely published (R8e)', () => {
    expect(bulkCanUnpublish('published')).toBe(true);
  });

  it('is false when unfiltered — unpublish has no server-side status guard, so bulk-unpublishing an unknown mix could move drafts/processing/failed rows to ready', () => {
    expect(bulkCanUnpublish(undefined)).toBe(false);
  });

  it('is false for every other status filter', () => {
    expect(bulkCanUnpublish('draft')).toBe(false);
    expect(bulkCanUnpublish('processing')).toBe(false);
    expect(bulkCanUnpublish('ready')).toBe(false);
    expect(bulkCanUnpublish('archived')).toBe(false);
    expect(bulkCanUnpublish('failed')).toBe(false);
  });
});
