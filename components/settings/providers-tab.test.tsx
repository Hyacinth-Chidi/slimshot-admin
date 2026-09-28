import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import * as providersApi from '@/lib/api/providers';
import { ProvidersTab } from './providers-tab';

vi.mock('@/lib/api/providers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/providers')>('@/lib/api/providers');
  return { ...actual, fetchProviders: vi.fn() };
});

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<ProvidersTab />, { wrapper: Wrapper });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('ProvidersTab', () => {
  it('renders the Auto caption section with one card per provider', async () => {
    vi.mocked(providersApi.fetchProviders).mockResolvedValue([
      { provider: 'deepgram', capability: 'speech_to_text', configured: true, active: true, updatedAt: null },
      { provider: 'elevenlabs', capability: 'speech_to_text', configured: false, active: false, updatedAt: null },
    ]);
    renderTab();

    expect(screen.getByRole('heading', { name: 'Auto caption' })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Speech to text with word timings, used by the app's Auto caption tool. Only one provider can be active.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Deepgram' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ElevenLabs' })).toBeInTheDocument();
    expect(providersApi.fetchProviders).toHaveBeenCalledWith('speech_to_text');
    expect(screen.queryByText(/Auto caption is off/)).toBeNull();
  });

  it('says so when no provider is active', async () => {
    vi.mocked(providersApi.fetchProviders).mockResolvedValue([
      { provider: 'deepgram', capability: 'speech_to_text', configured: false, active: false, updatedAt: null },
      { provider: 'elevenlabs', capability: 'speech_to_text', configured: false, active: false, updatedAt: null },
    ]);
    renderTab();
    expect(await screen.findByText(/Auto caption is off in the app/)).toBeInTheDocument();
  });
});
