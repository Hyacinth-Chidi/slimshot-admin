import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ProvidersPage from './page';
import type { AdminProfile } from '@/lib/auth/session';
import * as apiClient from '@/lib/api/client';
import * as providersApi from '@/lib/api/providers';

// useProfile calls its own module-local fetchMe, which calls apiFetch
// directly, so the profile is stubbed one layer down.
vi.mock('next/navigation', () => ({ usePathname: () => currentPath }));

let currentPath = '/system/providers';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('@/lib/api/providers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/providers')>('@/lib/api/providers');
  return { ...actual, fetchProviders: vi.fn() };
});

function profile(role: AdminProfile['role']): AdminProfile {
  return { id: '1', email: 'a@b.com', name: 'A', role };
}

function renderWith(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<>{ui}</>, { wrapper: Wrapper });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('System > AI providers', () => {
  it('tells a non-owner, and never asks for provider data', async () => {
    vi.mocked(apiClient.apiFetch).mockResolvedValue(profile('admin'));
    renderWith(<ProvidersPage />);
    expect(await screen.findByText('Only the owner can manage AI providers.')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(providersApi.fetchProviders).not.toHaveBeenCalled();
  });

  it('shows the owner the providers under System, with the System tabs', async () => {
    currentPath = '/system/providers';
    vi.mocked(apiClient.apiFetch).mockResolvedValue(profile('owner'));
    vi.mocked(providersApi.fetchProviders).mockResolvedValue([]);
    renderWith(<ProvidersPage />);

    expect(await screen.findByRole('heading', { name: 'Auto caption' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'AI providers' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('System')).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'System sections' });
    expect(within(tabs).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/system/providers',
      '/system/security',
      '/system/backups',
      '/system/audit',
    ]);
    expect(within(tabs).getByRole('link', { name: 'AI providers' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows a skeleton while the profile loads, not loading text', async () => {
    vi.mocked(apiClient.apiFetch).mockReturnValue(new Promise(() => {}));
    renderWith(<ProvidersPage />);
    expect(await screen.findByRole('status', { name: 'Loading AI providers' })).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
  });
});
