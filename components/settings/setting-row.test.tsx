import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api/client';
import type { MaskedSetting } from '@/lib/api/settings';
import * as settingsApi from '@/lib/api/settings';
import { SettingRow } from './setting-row';

vi.mock('@/lib/api/settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/settings')>('@/lib/api/settings');
  return { ...actual, updateSetting: vi.fn() };
});

function setting(overrides: Partial<MaskedSetting> & { key: string }): MaskedSetting {
  return {
    group: 'upload',
    type: 'string',
    isSecret: false,
    configured: true,
    description: 'A description',
    value: 'hello',
    ...overrides,
  };
}

function renderRow(s: MaskedSetting) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { ...render(<SettingRow setting={s} />, { wrapper: Wrapper }), client };
}

describe('SettingRow string field', () => {
  it('saves on blur when the value changed, sending the typed value', async () => {
    const user = userEvent.setup();
    vi.mocked(settingsApi.updateSetting).mockResolvedValue(undefined);
    renderRow(setting({ key: 'upload.ticketPrefix', value: 'old' }));

    const input = screen.getByRole('textbox', { name: /upload.ticketPrefix/i });
    await user.clear(input);
    await user.type(input, 'new-value');
    input.blur();

    await waitFor(() =>
      expect(settingsApi.updateSetting).toHaveBeenCalledWith('upload.ticketPrefix', 'new-value'),
    );
  });

  it('does not save on blur when the value is unchanged', async () => {
    renderRow(setting({ key: 'upload.ticketPrefix', value: 'old' }));
    const input = screen.getByRole('textbox', { name: /upload.ticketPrefix/i });
    input.focus();
    input.blur();

    await new Promise((r) => setTimeout(r, 10));
    expect(settingsApi.updateSetting).not.toHaveBeenCalled();
  });

  it('maps a 422 field error onto this row beneath the input', async () => {
    const user = userEvent.setup();
    vi.mocked(settingsApi.updateSetting).mockRejectedValue(
      new ApiError(
        {
          code: 'UNPROCESSABLE',
          message: 'Validation failed.',
          details: { value: ['must be at least 32 characters'] },
          traceId: 't',
        },
        422,
      ),
    );
    renderRow(setting({ key: 'auth.jwtAccessSecret', value: 'short' }));

    const input = screen.getByRole('textbox', { name: /auth.jwtAccessSecret/i });
    await user.clear(input);
    await user.type(input, 'still-too-short');
    input.blur();

    expect(await screen.findByText(/must be at least 32 characters/i)).toBeInTheDocument();
  });

  it('renders an empty input with a "Not set" hint when unconfigured', () => {
    renderRow(setting({ key: 'upload.ticketPrefix', configured: false, value: null }));
    const input = screen.getByRole('textbox', { name: /upload.ticketPrefix/i }) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.getByText(/not set/i)).toBeInTheDocument();
  });
});

describe('SettingRow boolean field', () => {
  it('renders a Switch and saves immediately on toggle', async () => {
    const user = userEvent.setup();
    vi.mocked(settingsApi.updateSetting).mockResolvedValue(undefined);
    renderRow(setting({ key: 'auth.bootstrapCompleted', type: 'boolean', value: false }));

    const toggle = screen.getByRole('switch', { name: /auth.bootstrapCompleted/i });
    await user.click(toggle);

    await waitFor(() =>
      expect(settingsApi.updateSetting).toHaveBeenCalledWith('auth.bootstrapCompleted', true),
    );
  });
});
