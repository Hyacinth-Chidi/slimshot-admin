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

  it.each([
    ['credits.adjusted', "Adjusted a user's credits"],
    ['user.suspended', 'Suspended a user'],
    ['user.unsuspended', "Lifted a user's suspension"],
    ['user.deleted', 'Deleted a user'],
    ['pricing.rule.created', 'Created a caption price'],
    ['pricing.rule.activated', 'Activated a caption price'],
    ['credits.settings.updated', 'Changed the credit settings'],
  ])('describes the credits action %s as "%s"', (action, text) => {
    expect(describeActivity(action)).toEqual({ text, tone: 'default' });
  });

  it('marks a balance mismatch as an error, since the books no longer balance', () => {
    expect(describeActivity('credits.reconcile.mismatch')).toEqual({
      text: "Found a balance that doesn't match its history",
      tone: 'error',
    });
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
