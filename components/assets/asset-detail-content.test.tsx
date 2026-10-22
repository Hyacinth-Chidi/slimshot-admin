import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as assetsApi from '@/lib/api/assets';
import type { AssetDetail } from '@/lib/api/assets';
import { ApiError } from '@/lib/api/client';
import { fetchTree } from '@/lib/api/categories';
import { toast } from '@/lib/use-toast';
import { AssetDetailContent } from './asset-detail-content';

vi.mock('next/navigation', () => ({
  usePathname: () => '/audio/a1',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

vi.mock('@/lib/api/assets', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/assets')>('@/lib/api/assets')),
  fetchAsset: vi.fn(),
  updateAsset: vi.fn(),
  publishAsset: vi.fn(),
  unpublishAsset: vi.fn(),
  removeCover: vi.fn(),
}));

vi.mock('@/lib/api/categories', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/categories')>('@/lib/api/categories')),
  fetchTree: vi.fn(),
}));

function makeAsset(overrides: Partial<AssetDetail> = {}): AssetDetail {
  return {
    id: 'a1',
    kind: 'audio',
    slug: 'rain-1a2b3c4d',
    title: 'Rain',
    author: 'Studio',
    status: 'ready',
    categoryId: null,
    durationMs: 65_000,
    createdAt: '2026-10-01T10:00:00.000Z',
    coverUrl: null,
    byteSize: 1_572_864,
    format: 'mp3',
    originalUrl: 'https://cdn.test/slimshot/audio/a1.mp3',
    publishedAt: null,
    previewUrl: null,
    keptForGood: false,
    face: null,
    version: null,
    downloadCount: 0,
    font: null,
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AssetDetailContent id="a1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(assetsApi.fetchAsset).mockReset();
  vi.mocked(assetsApi.updateAsset).mockReset();
  vi.mocked(assetsApi.publishAsset).mockReset();
  vi.mocked(assetsApi.unpublishAsset).mockReset();
  vi.mocked(toast).mockReset();
  vi.mocked(fetchTree).mockResolvedValue([
    {
      id: 'ui',
      kind: 'audio',
      parentId: null,
      slug: 'ui',
      name: 'UI',
      description: null,
      sortOrder: 0,
      isActive: true,
      children: [],
    },
  ]);
});

describe('AssetDetailContent', () => {
  it('shows a skeleton while the sound loads, never loading text', async () => {
    vi.mocked(assetsApi.fetchAsset).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(await screen.findByRole('status', { name: 'Loading sound' })).toBeInTheDocument();
    expect(screen.queryByText(/loading…/i)).toBeNull();
  });

  it('shows the title, author, status, duration and size', async () => {
    vi.mocked(assetsApi.fetchAsset).mockResolvedValue(makeAsset());
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Rain' })).toBeInTheDocument();
    expect(screen.getByLabelText('Author')).toHaveValue('Studio');
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('1.5 MB')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to audio/i })).toHaveAttribute('href', '/audio');
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(trail).getByRole('link', { name: 'Audio' })).toHaveAttribute('href', '/audio');
  });

  it('says the sound does not exist on a 404', async () => {
    vi.mocked(assetsApi.fetchAsset).mockRejectedValue(
      new ApiError({ code: 'NOT_FOUND', message: 'Asset not found: a1', traceId: 't' }, 404),
    );
    renderPage();
    expect(await screen.findByText('This sound does not exist')).toBeInTheDocument();
  });

  it('saves the title, author and category together', async () => {
    vi.mocked(assetsApi.fetchAsset).mockResolvedValue(makeAsset());
    vi.mocked(assetsApi.updateAsset).mockResolvedValue(makeAsset({ title: 'Heavy rain', categoryId: 'ui' }));
    renderPage();

    const save = await screen.findByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    const title = screen.getByLabelText('Title');
    await userEvent.clear(title);
    await userEvent.type(title, 'Heavy rain');
    const picker = screen.getByRole('combobox', { name: 'Category' });
    await vi.waitFor(() => expect(picker).toBeEnabled());
    await userEvent.click(picker);
    await userEvent.click(await screen.findByRole('option', { name: 'UI' }));

    expect(save).toBeEnabled();
    await userEvent.click(save);

    await vi.waitFor(() =>
      expect(assetsApi.updateAsset).toHaveBeenCalledWith('a1', {
        title: 'Heavy rain',
        authorName: 'Studio',
        categoryId: 'ui',
      }),
    );
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('Sound saved.', 'success'));
  });

  it('offers Publish for a ready sound and Unpublish for a published one', async () => {
    vi.mocked(assetsApi.fetchAsset).mockResolvedValue(makeAsset({ status: 'ready' }));
    vi.mocked(assetsApi.publishAsset).mockResolvedValue({});
    const { unmount } = renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    await vi.waitFor(() => expect(assetsApi.publishAsset).toHaveBeenCalledWith('a1'));
    expect(screen.queryByRole('button', { name: 'Unpublish' })).toBeNull();
    unmount();

    vi.mocked(assetsApi.fetchAsset).mockResolvedValue(makeAsset({ status: 'published' }));
    renderPage();
    expect(await screen.findByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
  });
});
