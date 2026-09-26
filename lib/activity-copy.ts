export interface ActivityCopy {
  text: string;
  /** `error` only for events worth an admin's attention, like a failed sign-in. */
  tone: 'default' | 'error';
}

const COPY: Record<string, ActivityCopy> = {
  'auth.login.succeeded': { text: 'Signed in', tone: 'default' },
  'auth.login.failed': { text: 'Failed sign-in attempt', tone: 'error' },
  'asset.upload.ticket': { text: 'Started an upload', tone: 'default' },
  'asset.upload.finalized': { text: 'Uploaded an asset', tone: 'default' },
  'asset.update': { text: 'Edited an asset', tone: 'default' },
  'asset.publish': { text: 'Published an asset', tone: 'default' },
  'asset.unpublish': { text: 'Unpublished an asset', tone: 'default' },
  'asset.delete': { text: 'Deleted an asset', tone: 'default' },
  'category.create': { text: 'Created a category', tone: 'default' },
  'category.update': { text: 'Updated a category', tone: 'default' },
  'category.delete': { text: 'Deleted a category', tone: 'default' },
  'category.reorder': { text: 'Reordered categories', tone: 'default' },
};

/**
 * Turns an audit action code into the sentence an admin reads. Unknown codes
 * are shown as-is: the server can add actions before the dashboard learns
 * their wording, and showing the code beats hiding the event.
 */
export function describeActivity(action: string): ActivityCopy {
  return COPY[action] ?? { text: action, tone: 'default' };
}
