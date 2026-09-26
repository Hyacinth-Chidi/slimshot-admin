import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '@/lib/api/audit';
import { ActivityTimeline } from './activity-timeline';

function entry(overrides: Partial<AuditEntry>): AuditEntry {
  return {
    id: 'e1',
    actorId: 'admin-1',
    actorType: 'admin',
    action: 'asset.publish',
    entityType: 'Asset',
    entityId: 'a1',
    before: null,
    after: null,
    ip: null,
    userAgent: null,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    ...overrides,
  };
}

describe('ActivityTimeline', () => {
  it('describes each event in plain language with a machine-readable time', () => {
    const e = entry({});
    render(<ActivityTimeline entries={[e]} />);
    expect(screen.getByText('Published an asset')).toBeInTheDocument();
    const time = screen.getByText('5m ago');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('dateTime', e.createdAt);
  });

  it('marks a failed sign-in as an error', () => {
    render(<ActivityTimeline entries={[entry({ id: 'e2', action: 'auth.login.failed' })]} />);
    expect(screen.getByTestId('activity-item')).toHaveAttribute('data-tone', 'error');
  });

  it('invites action when nothing has happened yet', () => {
    render(<ActivityTimeline entries={[]} />);
    expect(screen.getByText(/uploads, edits and sign-ins will show up here/i)).toBeInTheDocument();
  });

  it('renders nothing but its frame while loading', () => {
    render(<ActivityTimeline entries={undefined} />);
    expect(screen.queryByTestId('activity-item')).toBeNull();
    expect(screen.queryByText(/will show up here/i)).toBeNull();
  });
});
