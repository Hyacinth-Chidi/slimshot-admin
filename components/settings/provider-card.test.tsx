import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import * as providersApi from '@/lib/api/providers';
import type { ProviderStatus } from '@/lib/api/providers';
import { ProviderCard } from './provider-card';

vi.mock('@/lib/api/providers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/providers')>('@/lib/api/providers');
  return {
    ...actual,
    saveProviderKey: vi.fn(),
    removeProviderKey: vi.fn(),
    activateProvider: vi.fn(),
    deactivateProvider: vi.fn(),
    testProviderKey: vi.fn(),
  };
});

function status(overrides: Partial<ProviderStatus> = {}): ProviderStatus {
  return {
    provider: 'deepgram',
    capability: 'speech_to_text',
    configured: false,
    active: false,
    updatedAt: null,
    ...overrides,
  };
}

function renderCard(s: ProviderStatus) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<ProviderCard status={s} />, { wrapper: Wrapper });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('ProviderCard', () => {
  it('without a key: says so, offers Add key, and cannot be tested or made active', () => {
    renderCard(status());
    expect(screen.getByRole('heading', { name: 'Deepgram' })).toBeInTheDocument();
    expect(screen.getByText('No key')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add key' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Test key' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Make active' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Remove key' })).toBeNull();
  });

  it('with a saved key: offers Replace key and Make active', async () => {
    vi.mocked(providersApi.activateProvider).mockResolvedValue([]);
    const user = userEvent.setup();
    renderCard(status({ configured: true, updatedAt: '2026-09-28T10:00:00.000Z' }));

    expect(screen.getByText('Key saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace key' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Make active' }));
    expect(providersApi.activateProvider).toHaveBeenCalledWith('deepgram', 'speech_to_text');
  });

  it('when active: shows Active and Turn off', async () => {
    vi.mocked(providersApi.deactivateProvider).mockResolvedValue([]);
    const user = userEvent.setup();
    renderCard(status({ configured: true, active: true }));

    expect(screen.getByText('Active')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(providersApi.deactivateProvider).toHaveBeenCalledWith('deepgram', 'speech_to_text');
  });

  it('shows the key test result inline', async () => {
    vi.mocked(providersApi.testProviderKey).mockResolvedValue({
      ok: false,
      message: 'Deepgram rejected this key: Invalid credentials.',
    });
    const user = userEvent.setup();
    renderCard(status({ configured: true }));

    await user.click(screen.getByRole('button', { name: 'Test key' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Deepgram rejected this key: Invalid credentials.');
  });

  it('takes a key in a password field that starts empty and forgets what was typed', async () => {
    vi.mocked(providersApi.saveProviderKey).mockResolvedValue({ configured: true });
    const user = userEvent.setup();
    renderCard(status({ configured: true }));

    await user.click(screen.getByRole('button', { name: 'Replace key' }));
    const input = screen.getByLabelText('API key');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveValue('');

    await user.type(input, 'short');
    expect(screen.getByRole('button', { name: 'Save key' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Replace key' }));
    expect(screen.getByLabelText('API key')).toHaveValue('');

    await user.type(screen.getByLabelText('API key'), '  dg-new-key-123456  ');
    await user.click(screen.getByRole('button', { name: 'Save key' }));
    expect(providersApi.saveProviderKey).toHaveBeenCalledWith('deepgram', 'speech_to_text', 'dg-new-key-123456');
    await waitFor(() => expect(screen.queryByLabelText('API key')).toBeNull());
  });

  it('keeps the browser from filling in or saving the dashboard password as a key', async () => {
    // Browsers ignore autocomplete="off" on password fields; "new-password"
    // stops them offering the saved login password here.
    const user = userEvent.setup();
    renderCard(status());
    await user.click(screen.getByRole('button', { name: 'Add key' }));

    const input = screen.getByLabelText('API key');
    expect(input).toHaveAttribute('autocomplete', 'new-password');
    expect(input).toHaveAttribute('data-1p-ignore');
    expect(input).toHaveAttribute('data-lpignore', 'true');
  });

  it('shows a save error inside the dialog and keeps it open', async () => {
    vi.mocked(providersApi.saveProviderKey).mockRejectedValue(new Error('apiKey must be 8–512 characters.'));
    const user = userEvent.setup();
    renderCard(status());

    await user.click(screen.getByRole('button', { name: 'Add key' }));
    await user.type(screen.getByLabelText('API key'), 'dg-new-key-123456');
    await user.click(screen.getByRole('button', { name: 'Save key' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('apiKey must be 8–512 characters.');
    expect(screen.getByLabelText('API key')).toBeInTheDocument();
  });

  it('removes a key only after confirmation', async () => {
    vi.mocked(providersApi.removeProviderKey).mockResolvedValue({ configured: false });
    const user = userEvent.setup();
    renderCard(status({ configured: true, active: true }));

    await user.click(screen.getByRole('button', { name: 'Remove key' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Auto caption stops working');
    expect(providersApi.removeProviderKey).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Remove key' }));
    expect(providersApi.removeProviderKey).toHaveBeenCalledWith('deepgram', 'speech_to_text');
  });
});
