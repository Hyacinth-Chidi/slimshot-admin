import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuditFiltersBar } from './audit-filters';

describe('AuditFiltersBar', () => {
  it('renders inputs for actor, action and entity type — exactly the params the server DTO declares', () => {
    render(<AuditFiltersBar filters={{}} onChange={vi.fn()} pathname="/audit" />);
    // Two copies exist (inline md+ and inside the Sheet below md), so use getAllBy.
    expect(screen.getAllByLabelText(/actor/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/action/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/entity type/i).length).toBeGreaterThan(0);
  });

  it('calls onChange with only actorId/action/entityType keys when a field is committed', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AuditFiltersBar filters={{}} onChange={onChange} pathname="/audit" />);

    const [actionInput] = screen.getAllByLabelText(/^action$/i);
    await user.type(actionInput, 'auth.login.succeeded');
    await user.tab();

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(Object.keys(lastCall).every((k) => ['actorId', 'action', 'entityType'].includes(k))).toBe(
      true,
    );
    expect(lastCall.action).toBe('auth.login.succeeded');
  });

  it('reflects the current filter values in the inputs', () => {
    render(
      <AuditFiltersBar
        filters={{ actorId: 'a1', action: 'auth.login.succeeded', entityType: 'AdminUser' }}
        onChange={vi.fn()}
        pathname="/audit"
      />,
    );
    const [actorInput] = screen.getAllByLabelText(/actor/i);
    expect(actorInput).toHaveValue('a1');
  });
});
