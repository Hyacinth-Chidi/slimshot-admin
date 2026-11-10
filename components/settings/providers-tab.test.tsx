import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import * as providersApi from '@/lib/api/providers';
import { ProvidersTab } from './providers-tab';

vi.mock('@/lib/api/providers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/providers')>('@/lib/api/providers');
  return { ...actual, fetchProviders: vi.fn(), saveProviderKey: vi.fn() };
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

  it('shows xAI as a third provider, ready for a key', async () => {
    vi.mocked(providersApi.fetchProviders).mockResolvedValue([
      { provider: 'deepgram', capability: 'speech_to_text', configured: true, active: true, updatedAt: null },
      { provider: 'elevenlabs', capability: 'speech_to_text', configured: false, active: false, updatedAt: null },
      { provider: 'xai', capability: 'speech_to_text', configured: false, active: false, updatedAt: null },
    ]);
    renderTab();
    expect(await screen.findByRole('heading', { name: 'xAI' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add key' })).toHaveLength(2);
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

describe('ProvidersTab loading', () => {
  it('shows skeleton provider cards while the providers load', async () => {
    vi.mocked(providersApi.fetchProviders).mockReturnValue(new Promise(() => {}));
    renderTab();
    expect(await screen.findByRole('status', { name: 'Loading providers' })).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
  });
});

describe('ProvidersTab for text to speech', () => {
  const xaiVoices = { provider: 'xai', capability: 'text_to_speech', configured: false, active: false, updatedAt: null } as const;

  it('switches capability and lists what the server returns for it', async () => {
    vi.mocked(providersApi.fetchProviders).mockImplementation(async (capability) =>
      capability === 'text_to_speech'
        ? [xaiVoices]
        : [
            { provider: 'deepgram', capability: 'speech_to_text', configured: true, active: true, updatedAt: null },
            { provider: 'xai', capability: 'speech_to_text', configured: false, active: false, updatedAt: null },
          ],
    );
    renderTab();
    expect(await screen.findByRole('heading', { name: 'Deepgram' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Speech to text' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByRole('radio', { name: 'Text to speech' }));

    expect(await screen.findByRole('heading', { name: 'Text to speech' })).toBeInTheDocument();
    expect(providersApi.fetchProviders).toHaveBeenCalledWith('text_to_speech');
    expect(await screen.findByRole('heading', { name: 'xAI' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Deepgram' })).toBeNull();
    expect(screen.getByText('No provider is active, so Text to speech is off in the app.')).toBeInTheDocument();
  });

  it('saving a key sends the shown capability', async () => {
    vi.mocked(providersApi.fetchProviders).mockImplementation(async (capability) =>
      capability === 'text_to_speech' ? [xaiVoices] : [],
    );
    vi.mocked(providersApi.saveProviderKey).mockResolvedValue({ configured: true });
    renderTab();

    await userEvent.click(screen.getByRole('radio', { name: 'Text to speech' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add key' }));
    await userEvent.type(screen.getByLabelText('API key'), 'xai-key-123456');
    await userEvent.click(screen.getByRole('button', { name: 'Save key' }));

    expect(providersApi.saveProviderKey).toHaveBeenCalledWith('xai', 'text_to_speech', 'xai-key-123456');
  });
});
