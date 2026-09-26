import { describe, expect, it } from 'vitest';
import { describeActivity } from './activity-copy';

describe('describeActivity', () => {
  it.each([
    ['auth.login.succeeded', 'Signed in'],
    ['asset.upload.ticket', 'Started an upload'],
    ['asset.upload.finalized', 'Uploaded an asset'],
    ['asset.update', 'Edited an asset'],
    ['asset.publish', 'Published an asset'],
    ['asset.unpublish', 'Unpublished an asset'],
    ['asset.delete', 'Deleted an asset'],
    ['category.create', 'Created a category'],
    ['category.update', 'Updated a category'],
    ['category.delete', 'Deleted a category'],
    ['category.reorder', 'Reordered categories'],
  ])('describes %s as "%s"', (action, text) => {
    expect(describeActivity(action)).toEqual({ text, tone: 'default' });
  });

  it('marks a failed sign-in as an error, since it is a security signal', () => {
    expect(describeActivity('auth.login.failed')).toEqual({
      text: 'Failed sign-in attempt',
      tone: 'error',
    });
  });

  it('falls back to the raw action for anything it does not know', () => {
    // The server can add actions before the dashboard learns their wording;
    // showing the code is better than hiding the event.
    expect(describeActivity('asset.archive')).toEqual({ text: 'asset.archive', tone: 'default' });
  });
});
