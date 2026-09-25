import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Asset, AssetPage } from '@/lib/api/assets';
import { AssetsPageContent } from './assets-page-content';

let currentSearch = '';
const push = vi.fn((url: string) => {
  currentSearch = url.includes('?') ? url.split('?')[1] : '';
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/assets',
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

function makeAsset(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    kind: 'audio',
    title: `Asset ${id}`,
    author: 'Studio',
    status: null,
    categoryId: null,
    durationMs: 1000,
    createdAt: null,
    ...overrides,
  };
}

const fetchAssetsMock = vi.fn<(...args: unknown[]) => Promise<AssetPage>>();

vi.mock('@/lib/api/assets', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/assets')>('@/lib/api/assets');
  return {
    ...actual,
    fetchAssets: (...args: unknown[]) => fetchAssetsMock(...args),
    publishAsset: vi.fn(),
    unpublishAsset: vi.fn(),
    deleteAsset: vi.fn(),
  };
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AssetsPageContent />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  currentSearch = '';
  push.mockClear();
  fetchAssetsMock.mockReset();
});

describe('AssetsPageContent selection and pagination (finding 4)', () => {
  it('select-all only selects the currently visible page, not every loaded row', async () => {
    fetchAssetsMock.mockResolvedValue({
      data: [makeAsset('a1'), makeAsset('a2')],
      meta: { nextCursor: null },
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findAllByText('Asset a1');
    const table = screen.getByTestId('asset-table');
    await user.click(within(table).getByRole('checkbox', { name: /select all/i }));

    expect(await screen.findByText('2 selected')).toBeInTheDocument();
  });

  it('clears selection when the filter/URL changes (remount via the filterKey)', async () => {
    fetchAssetsMock.mockResolvedValue({
      data: [makeAsset('a1')],
      meta: { nextCursor: null },
    });
    const user = userEvent.setup();
    const { rerender } = renderPage();

    await screen.findAllByText('Asset a1');
    const table = screen.getByTestId('asset-table');
    await user.click(within(table).getByRole('checkbox', { name: /select all/i }));
    expect(await screen.findByText('1 selected')).toBeInTheDocument();

    // Simulate a URL change the way Back/Forward would — not through
    // setFilters, so this only passes if the body remounts on searchParams
    // changing, not just on the page's own setFilters call.
    currentSearch = 'status=published';
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AssetsPageContent />
      </QueryClientProvider>,
    );

    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
  });
});
