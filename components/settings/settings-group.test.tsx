import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MaskedSetting } from '@/lib/api/settings';
import { SettingsGroup } from './settings-group';

vi.mock('@/lib/api/settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/settings')>('@/lib/api/settings');
  return { ...actual, fetchSettings: vi.fn() };
});

const REDIS: MaskedSetting = {
  key: 'redis.url',
  group: 'infrastructure',
  type: 'string',
  isSecret: true,
  configured: true,
  description: 'Connection URL for Redis (cache, queue, rate limiting).',
  value: 'redis://••••7474',
};

function renderGroup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SettingsGroup group="infrastructure" enabled />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.clearAllMocks());

describe('SettingsGroup', () => {
  it('renders a secrets-only group, with each secret as a locked field', async () => {
    const settings = await import('@/lib/api/settings');
    vi.mocked(settings.fetchSettings).mockResolvedValueOnce([REDIS]);
    const { container } = renderGroup();

    const input = (await screen.findByLabelText(/connection url for redis/i)) as HTMLInputElement;
    expect(input.value).toBe('••••••••••');
    expect(input).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: /reveal/i })).toBeInTheDocument();
    // The API's mask is passed through props but must never reach the DOM.
    expect(container.innerHTML).not.toContain('7474');
  });
});
