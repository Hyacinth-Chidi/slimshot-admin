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

/**
 * Renders with a SINGLE QueryClient shared across every render/rerender in a
 * test, and returns a `rerenderPage` that reuses the SAME element tree (via
 * testing-library's `rerender`, not a fresh `render`). This is deliberate: a
 * fresh QueryClient per rerender would wipe query state regardless of
 * whether AssetsPageContent itself remounted, which would let a real
 * regression (the round-2 bug: AssetsPageBody remounting on every URL
 * change) hide behind a passing test. Keeping one QueryClient and one
 * `rerender` call is what actually exercises "does this component tree stay
 * mounted."
 */
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <AssetsPageContent />
    </QueryClientProvider>,
  );
  return {
    ...utils,
    rerenderPage: () =>
      utils.rerender(
        <QueryClientProvider client={client}>
          <AssetsPageContent />
        </QueryClientProvider>,
      ),
  };
}

beforeEach(() => {
  currentSearch = '';
  push.mockClear();
  fetchAssetsMock.mockReset();
});

describe('AssetsPageContent selection and pagination', () => {
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

  it('clears selection when the filter/URL changes externally, without remounting the page body', async () => {
    fetchAssetsMock.mockResolvedValue({
      data: [makeAsset('a1')],
      meta: { nextCursor: null },
    });
    const user = userEvent.setup();
    const { rerenderPage } = renderPage();

    await screen.findAllByText('Asset a1');
    const table = screen.getByTestId('asset-table');
    await user.click(within(table).getByRole('checkbox', { name: /select all/i }));
    expect(await screen.findByText('1 selected')).toBeInTheDocument();

    // Simulate a URL change the way Back/Forward would — not through the
    // page's own setFilters call.
    currentSearch = 'status=published';
    rerenderPage();

    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
  });
});

describe('AssetsPageContent search input (round-2 regression: focus loss + loading flash)', () => {
  it('never remounts the page body on a filter change — the same wrapping DOM node identity survives it', async () => {
    fetchAssetsMock.mockResolvedValue({
      data: [makeAsset('a1')],
      meta: { nextCursor: null },
    });
    const { rerenderPage } = renderPage();

    await screen.findAllByText('Asset a1');
    const cardsBefore = screen.getByTestId('asset-cards');

    // A filter change through the URL (what committing a search does) —
    // same QueryClient, same rerender call, no key on AssetsPageBody.
    currentSearch = 'search=rain';
    rerenderPage();
    await screen.findAllByText('Asset a1');

    const cardsAfter = screen.getByTestId('asset-cards');
    // Same DOM node identity: a remount would have produced a brand-new
    // element here, which is exactly what dropped focus on the search input
    // in the round-2 regression.
    expect(cardsAfter).toBe(cardsBefore);
  });

  it('keeps the previously rendered rows visible (no "Loading…" text) once a filter change is in flight, because the query observer is never recreated', async () => {
    let resolveSecondFetch: ((page: AssetPage) => void) | undefined;
    fetchAssetsMock
      .mockResolvedValueOnce({ data: [makeAsset('a1')], meta: { nextCursor: null } })
      .mockImplementationOnce(
        () =>
          new Promise<AssetPage>((resolve) => {
            resolveSecondFetch = resolve;
          }),
      );

    const { rerenderPage } = renderPage();
    await screen.findAllByText('Asset a1');

    // Change the filter externally (mirrors a committed search) while the
    // second fetch is still pending.
    currentSearch = 'search=rain';
    rerenderPage();

    // keepPreviousData means the old row is still visible and there is no
    // "Loading…" placeholder while the new page is in flight.
    expect(screen.queryByText(/loading assets/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Asset a1').length).toBeGreaterThan(0);

    resolveSecondFetch?.({ data: [makeAsset('a2')], meta: { nextCursor: null } });
    await screen.findAllByText('Asset a2');
  });
});
