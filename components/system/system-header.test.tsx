import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SystemHeader } from './system-header';

vi.mock('next/navigation', () => ({ usePathname: () => '/system/audit' }));
vi.mock('@/lib/auth/profile', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  // The real hook's query key, served only from the cache (no network in tests).
  return { useProfile: () => useQuery({ queryKey: ['auth', 'me'], queryFn: () => new Promise(() => {}) }) };
});

const OWNER = { id: 'a1', email: 'owner@slimshot.dev', name: 'Owner', role: 'owner' };

function wrap(client: QueryClient, actions?: ReactNode) {
  return (
    <QueryClientProvider client={client}>
      <SystemHeader title="Audit log" actions={actions} />
    </QueryClientProvider>
  );
}

describe('SystemHeader', () => {
  // The Audit page hydrated with a hydration error: its Suspense boundary
  // hydrates after the profile has loaded, so the browser drew role-dependent
  // tabs the server never drew. The first markup must not depend on the cache.
  it('renders the same first markup whether or not the profile is already cached', () => {
    const cold = renderToString(wrap(new QueryClient()));
    const warm = new QueryClient();
    warm.setQueryData(['auth', 'me'], OWNER);
    expect(renderToString(wrap(warm))).toBe(cold);
  });

  it('shows the owner the four System tabs once mounted, on phones only', async () => {
    const client = new QueryClient();
    client.setQueryData(['auth', 'me'], OWNER);
    render(wrap(client));

    const nav = await screen.findByRole('navigation', { name: 'System sections' });
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'AI providers',
      'Sign-in security',
      'Backups',
      'Audit log',
    ]);
    expect(nav).toHaveClass('md:hidden');
  });

  it("puts the page's actions in the header", () => {
    render(wrap(new QueryClient(), <button type="button">Back up now</button>));
    expect(screen.getByRole('button', { name: 'Back up now' })).toBeInTheDocument();
  });

  it('shows no tabs to anyone else', async () => {
    const client = new QueryClient();
    client.setQueryData(['auth', 'me'], { ...OWNER, role: 'admin' });
    render(wrap(client));
    expect(await screen.findByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'System sections' })).toBeNull();
  });
});
