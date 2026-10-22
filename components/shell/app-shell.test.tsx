import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

let role = 'owner';

vi.mock('next/navigation', () => ({ usePathname: () => '/audio/categories' }));
vi.mock('@/lib/auth/profile', () => ({ useProfile: () => ({ data: { role }, isLoading: false }) }));
vi.mock('@/lib/api/kinds', () => ({
  fetchKinds: vi.fn(async () => [{ kind: 'audio', label: 'Audio', extensions: ['.mp3'], fileRoles: [] }]),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderShell() {
  return render(
    <AppShell>
      <p>content</p>
    </AppShell>,
    { wrapper },
  );
}

const hrefs = (el: HTMLElement) => [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));

describe('AppShell', () => {
  it('renders both the sidebar and the bottom nav, each responsibility-scoped', () => {
    renderShell();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument();
  });

  it('hides the sidebar below md and the bottom nav at md and up', () => {
    renderShell();
    expect(screen.getByTestId('sidebar')).toHaveClass('hidden', 'md:flex');
    expect(screen.getByTestId('bottom-nav')).toHaveClass('md:hidden');
  });

  it('marks the current section once in each nav', async () => {
    renderShell();
    const sidebar = screen.getByTestId('sidebar');
    expect(await within(sidebar).findByRole('link', { name: 'Audio' })).toHaveAttribute('data-testid', 'nav-active');
    expect(within(screen.getByTestId('bottom-nav')).getByRole('link', { name: 'Library' })).toHaveAttribute(
      'data-testid',
      'nav-active',
    );
    expect(screen.getAllByTestId('nav-active')).toHaveLength(2);
  });

  it('lays the sidebar out as Overview, Library, People and System', async () => {
    renderShell();
    const sidebar = screen.getByTestId('sidebar');
    await within(sidebar).findByRole('link', { name: 'Audio' });
    expect(hrefs(sidebar)).toEqual([
      '/',
      '/audio',
      '/users',
      '/system/providers',
      '/system/credits',
      '/system/audit',
    ]);
    for (const heading of ['Library', 'People', 'System']) {
      expect(within(sidebar).getByText(heading)).toBeInTheDocument();
    }
  });

  it('gives the phone four sections and no separate Settings', () => {
    renderShell();
    expect(hrefs(screen.getByTestId('bottom-nav'))).toEqual(['/', '/audio', '/users', '/system/providers']);
    const bar = screen.getByTestId('mobile-top-bar');
    expect(within(bar).queryByRole('link', { name: 'Settings' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
  });

  it('shows a non-owner only the System pages they can use', async () => {
    role = 'admin';
    try {
      renderShell();
      const sidebar = screen.getByTestId('sidebar');
      await within(sidebar).findByRole('link', { name: 'Audio' });
      expect(within(sidebar).queryByRole('link', { name: 'AI providers' })).toBeNull();
      expect(within(sidebar).queryByRole('link', { name: 'Credits' })).toBeNull();
      expect(within(sidebar).getByRole('link', { name: 'Audit log' })).toBeInTheDocument();
      expect(within(screen.getByTestId('bottom-nav')).getByRole('link', { name: 'System' })).toHaveAttribute(
        'href',
        '/system/audit',
      );
    } finally {
      role = 'owner';
    }
  });

  it('puts a log out button in a phone-only top bar', () => {
    renderShell();
    const bar = screen.getByTestId('mobile-top-bar');
    expect(bar).toHaveClass('md:hidden');
    expect(within(bar).getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('renders its children', () => {
    renderShell();
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
