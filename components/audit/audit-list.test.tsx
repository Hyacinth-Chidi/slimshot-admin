import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '@/lib/api/audit';
import { AuditList } from './audit-list';

const ENTRIES: AuditEntry[] = [
  {
    id: 'log1',
    actorId: 'cmue7d44p0000dsulkoy9vmk6',
    actorType: 'admin',
    action: 'auth.login.succeeded',
    entityType: 'AdminUser',
    entityId: 'cmue7d44p0000dsulkoy9vmk6',
    before: null,
    after: { foo: 'bar' },
    ip: '::1',
    userAgent: 'curl/8.12.1',
    createdAt: '2026-09-23T15:28:37.268Z',
  },
];

describe('AuditList', () => {
  it('renders a table for desktop and a stacked list for mobile, both mounted', () => {
    render(<AuditList entries={ENTRIES} />);
    expect(screen.getByTestId('audit-table')).toBeInTheDocument();
    expect(screen.getByTestId('audit-cards')).toBeInTheDocument();
  });

  it('hides the table below md and the cards at md and up', () => {
    render(<AuditList entries={ENTRIES} />);
    expect(screen.getByTestId('audit-table')).toHaveClass('hidden', 'md:block');
    expect(screen.getByTestId('audit-cards')).toHaveClass('md:hidden');
  });

  it('links an app-user entry to that user, on both layouts', () => {
    const entry: AuditEntry = { ...ENTRIES[0], id: 'log2', action: 'user.suspended', entityType: 'User', entityId: 'u1' };
    render(<AuditList entries={[entry]} />);
    for (const id of ['audit-table', 'audit-cards']) {
      expect(within(screen.getByTestId(id)).getByRole('link', { name: /User/ })).toHaveAttribute('href', '/users/u1');
    }
  });

  it('leaves other entity types as plain text', () => {
    render(<AuditList entries={ENTRIES} />);
    expect(screen.queryByRole('link', { name: /AdminUser/ })).toBeNull();
  });

  it('uses a real table element on desktop', () => {
    render(<AuditList entries={ENTRIES} />);
    expect(screen.getByTestId('audit-table').querySelector('table')).not.toBeNull();
  });

  it('does NOT use a table element in the mobile list', () => {
    render(<AuditList entries={ENTRIES} />);
    expect(screen.getByTestId('audit-cards').querySelector('table')).toBeNull();
  });

  it('renders actor, action, entity and an absolute timestamp in the desktop table', () => {
    render(<AuditList entries={ENTRIES} />);
    const table = screen.getByTestId('audit-table');
    expect(within(table).getByText('auth.login.succeeded')).toBeInTheDocument();
    expect(within(table).getAllByText(/admin/i).length).toBeGreaterThan(0);
    expect(within(table).getByText(/AdminUser/)).toBeInTheDocument();
    expect(within(table).getByText(/2026/)).toBeInTheDocument();
  });

  it('renders actor, action, entity and an absolute timestamp in the mobile cards', () => {
    render(<AuditList entries={ENTRIES} />);
    const cards = screen.getByTestId('audit-cards');
    expect(within(cards).getByText('auth.login.succeeded')).toBeInTheDocument();
    expect(within(cards).getAllByText(/admin/i).length).toBeGreaterThan(0);
    expect(within(cards).getByText(/AdminUser/)).toBeInTheDocument();
    expect(within(cards).getByText(/2026/)).toBeInTheDocument();
  });

  it('renders no delete/remove affordance anywhere — the API offers no delete route', () => {
    render(<AuditList entries={ENTRIES} />);
    const deleteish = /delete|remove/i;
    expect(screen.queryByRole('button', { name: deleteish })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: deleteish })).not.toBeInTheDocument();
  });

  it('expands a row to show pretty-printed before/after JSON', async () => {
    const user = userEvent.setup();
    render(<AuditList entries={ENTRIES} />);
    const table = screen.getByTestId('audit-table');
    await user.click(within(table).getByRole('button', { name: /details|expand/i }));
    expect(screen.getByText(/"foo"/)).toBeInTheDocument();
    expect(screen.getByText(/"bar"/)).toBeInTheDocument();
  });

  it('renders the distinct empty state when there are no entries at all', () => {
    render(<AuditList entries={[]} />);
    expect(screen.getByText(/no audit entries yet/i)).toBeInTheDocument();
  });

  it('renders the distinct filtered-empty state when filters are active but return nothing', () => {
    render(<AuditList entries={[]} hasActiveFilters />);
    expect(screen.getByText(/no entries match these filters/i)).toBeInTheDocument();
  });
});
