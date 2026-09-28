import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AdminProfile } from '@/lib/auth/session';
import * as apiClient from '@/lib/api/client';
import * as providersApi from '@/lib/api/providers';
import SettingsPage from './page';

// useProfile calls its own module-local fetchMe, which calls apiFetch
// directly, so the profile is stubbed one layer down.
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

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<SettingsPage />, { wrapper: Wrapper });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('SettingsPage', () => {
  it('tells a non-owner, and never asks for provider data', async () => {
    vi.mocked(apiClient.apiFetch).mockResolvedValue(profile('admin'));
    renderPage();

    expect(await screen.findByText('Only the owner can manage settings.')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(providersApi.fetchProviders).not.toHaveBeenCalled();
  });

  it('shows the owner the Providers tab with the Auto caption section', async () => {
    vi.mocked(apiClient.apiFetch).mockResolvedValue(profile('owner'));
    vi.mocked(providersApi.fetchProviders).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByRole('tab', { name: 'Providers' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('heading', { name: 'Auto caption' })).toBeInTheDocument();
  });
});
