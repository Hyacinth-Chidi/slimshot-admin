import { render, screen, within } from '@testing-library/react';
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

  it('offers the four peers on both navs, and Settings apart from them', () => {
    render(<AppShell><p>content</p></AppShell>);
    const hrefs = (el: HTMLElement) => [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));

    expect(hrefs(screen.getByTestId('bottom-nav'))).toEqual(['/', '/assets', '/categories', '/audit']);
    expect(hrefs(screen.getByTestId('sidebar'))).toEqual(['/', '/assets', '/categories', '/audit', '/settings']);
    const bar = screen.getByTestId('mobile-top-bar');
    expect(within(bar).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });

  it('puts a log out button in a phone-only top bar', () => {
    render(<AppShell><p>content</p></AppShell>);
    const bar = screen.getByTestId('mobile-top-bar');
    expect(bar).toHaveClass('md:hidden');
    expect(within(bar).getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('renders its children', () => {
    render(<AppShell><p>content</p></AppShell>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
