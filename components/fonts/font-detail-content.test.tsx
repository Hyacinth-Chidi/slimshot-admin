import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as assetsApi from '@/lib/api/assets';
import type { AssetDetail, FontDetail } from '@/lib/api/assets';
import { ApiError } from '@/lib/api/client';
import { fetchTree } from '@/lib/api/categories';
import { updateFontLicense } from '@/lib/api/fonts';
import { uploadFontVersion } from '@/lib/upload/font-version';
import { toast } from '@/lib/use-toast';
import { FontDetailContent } from './font-detail-content';

vi.mock('next/navigation', () => ({
  usePathname: () => '/fonts/f1',
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
}));
vi.mock('@/lib/api/categories', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/categories')>('@/lib/api/categories')),
  fetchTree: vi.fn(),
}));
vi.mock('@/lib/api/fonts', () => ({ updateFontLicense: vi.fn() }));
vi.mock('@/lib/upload/font-version', () => ({ uploadFontVersion: vi.fn() }));

function makeFont(overrides: Partial<AssetDetail> = {}, font: Partial<FontDetail> = {}): AssetDetail {
  return {
    id: 'f1',
    kind: 'font',
    slug: 'lato-regular-1a2b3c4d',
    title: 'Lato Regular',
    author: null,
    status: 'ready',
    categoryId: 'trending',
    durationMs: null,
    createdAt: '2026-10-22T10:00:00.000Z',
    coverUrl: null,
    byteSize: 75_000,
    format: 'ttf',
    originalUrl: 'https://cdn.test/slimshot/fonts/f1.ttf',
    previewUrl: 'https://cdn.test/slimshot/fonts/previews/p1.png',
    publishedAt: null,
    keptForGood: false,
    face: 'Lato · Regular',
    version: 2,
    downloadCount: 41,
    font: {
      familyName: 'Lato',
      styleName: 'Regular',
      fullName: 'Lato Regular',
      postscriptName: 'Lato-Regular',
      version: 2,
      sortOrder: 1,
      firstPublishedAt: null,
      license: 'SIL Open Font License 1.1',
      ...font,
    },
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FontDetailContent id="f1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(assetsApi.fetchAsset).mockReset();
  vi.mocked(assetsApi.updateAsset).mockReset();
  vi.mocked(assetsApi.publishAsset).mockReset();
  vi.mocked(updateFontLicense).mockReset().mockResolvedValue(undefined);
  vi.mocked(uploadFontVersion).mockReset().mockResolvedValue(undefined);
  vi.mocked(toast).mockReset();
  vi.mocked(fetchTree).mockResolvedValue([
    {
      id: 'trending',
      kind: 'font',
      parentId: null,
      slug: 'trending',
      name: 'Trending',
      description: null,
      sortOrder: 0,
      isActive: true,
      children: [],
    },
  ]);
});

describe('FontDetailContent', () => {
  it('shows a skeleton while the font loads, never loading text', async () => {
    vi.mocked(assetsApi.fetchAsset).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: 'Loading font' })).toBeInTheDocument();
    expect(screen.queryByText(/loading…/i)).toBeNull();
  });

  it('shows the preview and what the server read from the file', async () => {
    vi.mocked(assetsApi.fetchAsset).mockResolvedValue(makeFont());
    renderPage();

    expect(await screen.findByRole('img', { name: 'Lato Regular preview' })).toHaveAttribute(
      'src',
      'https://cdn.test/slimshot/fonts/previews/p1.png',
    );
    const facts = screen.getByRole('list', { name: 'Font details' });
    for (const text of ['Lato', 'Regular', 'Version 2', 'TTF', '41 downloads']) expect(facts).toHaveTextContent(text);
    expect(screen.getByRole('link', { name: /Download file/ })).toHaveAttribute(
      'href',
      'https://cdn.test/slimshot/fonts/f1.ttf',
    );
  });

  it('says the font does not exist on a 404', async () => {
    vi.mocked(assetsApi.fetchAsset).mockRejectedValue(new ApiError({ code: 'NOT_FOUND', message: 'Asset not found: f1', traceId: 't' }, 404));
    renderPage();
    expect(await screen.findByText('This font does not exist')).toBeInTheDocument();
  });

  it('cannot publish a font with no preview, and says why', async () => {
    vi.mocked(assetsApi.fetchAsset).mockResolvedValue(makeFont({ previewUrl: null }));
    renderPage();

    expect(await screen.findAllByText('No preview yet')).not.toHaveLength(0);
    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAccessibleDescription(/No preview yet/);
  });

  it('publishes a ready font that was never published', async () => {
    vi.mocked(assetsApi.fetchAsset).mockResolvedValue(makeFont());
    vi.mocked(assetsApi.publishAsset).mockResolvedValue({});
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    await vi.waitFor(() => expect(assetsApi.publishAsset).toHaveBeenCalledWith('f1'));
  });

  it('offers neither Publish nor Unpublish once the font was published, and says it is kept', async () => {
    vi.mocked(assetsApi.fetchAsset).mockResolvedValue(
      makeFont({ status: 'published', keptForGood: true }, { firstPublishedAt: '2026-10-20T09:00:00.000Z' }),
    );
    renderPage();

    expect(await screen.findByText(/stays available for the projects that use it/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unpublish' })).toBeNull();
  });

  it('saves the display name and category, then shows the redrawn preview', async () => {
    vi.mocked(assetsApi.fetchAsset).mockResolvedValue(makeFont());
    vi.mocked(assetsApi.updateAsset).mockResolvedValue(makeFont({ title: 'Lato Text' }));
    renderPage();

    const save = await screen.findByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    expect(screen.queryByLabelText('Author')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeInTheDocument();

    const name = screen.getByLabelText('Display name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Lato Text');
    await userEvent.click(save);

    await vi.waitFor(() =>
      expect(assetsApi.updateAsset).toHaveBeenCalledWith('f1', { title: 'Lato Text', categoryId: 'trending' }),
    );
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('Font saved.', 'success'));
    // The rename redraws the preview on the server; the page fetches it again.
    await vi.waitFor(() => expect(assetsApi.fetchAsset).toHaveBeenCalledTimes(2));
  });

  it('saves the licence note, and clears it when emptied', async () => {
    vi.mocked(assetsApi.fetchAsset).mockResolvedValue(makeFont());
    renderPage();

    const licence = await screen.findByLabelText('Licence');
    expect(licence).toHaveValue('SIL Open Font License 1.1');
    expect(screen.getByRole('button', { name: 'Save licence' })).toBeDisabled();

    await userEvent.clear(licence);
    await userEvent.type(licence, 'OFL 1.1, bundled with the app');
    await userEvent.click(screen.getByRole('button', { name: 'Save licence' }));
    await vi.waitFor(() => expect(updateFontLicense).toHaveBeenCalledWith('f1', 'OFL 1.1, bundled with the app'));
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('Licence saved.', 'success'));

    await userEvent.clear(licence);
    await userEvent.click(screen.getByRole('button', { name: 'Save licence' }));
    await vi.waitFor(() => expect(updateFontLicense).toHaveBeenLastCalledWith('f1', null));
  });

  it('uploads a new version of the same font', async () => {
    vi.mocked(assetsApi.fetchAsset).mockResolvedValue(makeFont());
    renderPage();

    const input = (await screen.findByLabelText('Upload new version')) as HTMLInputElement;
    expect(input).toHaveAttribute('accept', '.ttf,.otf');
    const file = new File(['ttf'], 'Lato-Regular.ttf', { type: '' });
    await userEvent.upload(input, file);

    await vi.waitFor(() => expect(uploadFontVersion).toHaveBeenCalledWith('f1', file));
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('New version uploaded.', 'success'));
    await vi.waitFor(() => expect(assetsApi.fetchAsset).toHaveBeenCalledTimes(2));
  });

  it("shows the server's reason under the button when a new version is refused", async () => {
    vi.mocked(assetsApi.fetchAsset).mockResolvedValue(makeFont());
    vi.mocked(uploadFontVersion).mockRejectedValue(new Error('This file is Lato Bold, not Lato Regular.'));
    renderPage();

    const input = (await screen.findByLabelText('Upload new version')) as HTMLInputElement;
    await userEvent.upload(input, new File(['ttf'], 'Lato-Bold.ttf', { type: '' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This file is Lato Bold, not Lato Regular.');
  });
});
