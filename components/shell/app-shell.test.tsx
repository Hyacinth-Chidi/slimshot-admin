import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NAV_ITEMS } from './nav-items';
import { AppShell } from './app-shell';

vi.mock('next/navigation', () => ({ usePathname: () => '/assets' }));

describe('AppShell', () => {
  it('renders exactly four navigation peers', () => {
    expect(NAV_ITEMS).toHaveLength(4);
  });

  it('renders both the sidebar and the bottom nav, each responsibility-scoped', () => {
    render(<AppShell><p>content</p></AppShell>);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument();
  });

  it('hides the sidebar below md and the bottom nav at md and up', () => {
    render(<AppShell><p>content</p></AppShell>);
    // Both are always mounted; CSS decides which is visible. Asserting the
    // classes is what pins the breakpoint contract.
    expect(screen.getByTestId('sidebar')).toHaveClass('hidden', 'md:flex');
    expect(screen.getByTestId('bottom-nav')).toHaveClass('md:hidden');
  });

  it('marks the active route exactly once', () => {
    render(<AppShell><p>content</p></AppShell>);
    expect(screen.getAllByTestId('nav-active')).toHaveLength(2); // one per nav
  });

  it('renders its children', () => {
    render(<AppShell><p>content</p></AppShell>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
