import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusPill } from './status-pill';

describe('StatusPill', () => {
  it.each([
    ['draft', 'Draft'],
    ['processing', 'Processing'],
    ['ready', 'Ready'],
    ['published', 'Published'],
    ['archived', 'Archived'],
    ['failed', 'Failed'],
  ] as const)('renders %s as %s', (status, label) => {
    render(<StatusPill status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('gives failed and published visually distinct classes', () => {
    const { container: failed } = render(<StatusPill status="failed" />);
    const { container: published } = render(<StatusPill status="published" />);
    expect(failed.firstChild).not.toHaveClass(
      ...Array.from((published.firstChild as HTMLElement).classList),
    );
  });

  it('renders an unknown status without crashing', () => {
    // The API's enum can gain a value before the dashboard knows about it. A
    // lookup that returns undefined and then reads .label would crash the row.
    render(<StatusPill status={'invented' as never} />);
    expect(screen.getByText('invented')).toBeInTheDocument();
  });
});
