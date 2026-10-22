import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as categoriesApi from '@/lib/api/categories';
import * as fontsApi from '@/lib/api/fonts';
import { toast } from '@/lib/use-toast';
import { FontOrder } from './font-order';

const TRENDING = {
  id: 'cat-t',
  kind: 'font',
  parentId: null,
  slug: 'trending',
  name: 'Trending',
  description: null,
  sortOrder: 0,
  isActive: true,
  children: [],
};

const ROWS = [
  { id: 'a', title: 'Alpha Regular', styleName: 'Regular', previewUrl: 'https://cdn.test/a.png', status: 'published' as const },
  { id: 'b', title: 'Bravo Bold', styleName: 'Bold', previewUrl: 'https://cdn.test/b.png', status: 'published' as const },
  { id: 'c', title: 'Charlie Italic', styleName: 'Italic', previewUrl: null, status: 'ready' as const },
];

vi.mock('@/lib/api/categories', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/categories')>('@/lib/api/categories')),
  fetchTree: vi.fn(),
}));
vi.mock('@/lib/api/fonts', () => ({ fetchFontOrder: vi.fn(), reorderFonts: vi.fn() }));
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

beforeEach(() => {
  vi.mocked(categoriesApi.fetchTree).mockResolvedValue([TRENDING]);
  vi.mocked(fontsApi.fetchFontOrder).mockResolvedValue(ROWS);
  vi.mocked(fontsApi.reorderFonts).mockReset().mockResolvedValue(undefined);
  vi.mocked(toast).mockReset();
});

function renderOrder() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FontOrder />
    </QueryClientProvider>,
  );
}

async function titles() {
  const list = await screen.findByRole('list', { name: 'Trending order' });
  return within(list)
    .getAllByRole('listitem')
    .map((li) => within(li).getByTestId('font-title').textContent);
}

describe('FontOrder', () => {
  it("lists Trending's fonts by position, with their previews", async () => {
    renderOrder();

    expect(await titles()).toEqual(['Alpha Regular', 'Bravo Bold', 'Charlie Italic']);
    expect(fontsApi.fetchFontOrder).toHaveBeenCalledWith('cat-t');
    const first = screen.getAllByRole('listitem')[0];
    expect(first).toHaveTextContent('1');
    expect(within(first).getByRole('img', { name: 'Alpha Regular preview' })).toBeInTheDocument();
  });

  it('moves a font with Move up and Move down, saving the whole new order', async () => {
    renderOrder();
    await titles();

    await userEvent.click(screen.getByRole('button', { name: 'Move Alpha Regular down' }));
    expect(fontsApi.reorderFonts).toHaveBeenCalledWith('cat-t', ['b', 'a', 'c']);
    expect(await titles()).toEqual(['Bravo Bold', 'Alpha Regular', 'Charlie Italic']);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Move Charlie Italic up' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Move Charlie Italic up' }));
    expect(fontsApi.reorderFonts).toHaveBeenLastCalledWith('cat-t', ['b', 'c', 'a']);
  });

  it('cannot move the first font up or the last one down', async () => {
    renderOrder();
    await titles();
    expect(screen.getByRole('button', { name: 'Move Alpha Regular up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Charlie Italic down' })).toBeDisabled();
  });

  it('reorders by dragging one font onto another', async () => {
    renderOrder();
    await titles();

    fireEvent.dragStart(screen.getByTestId('font-row-c'));
    fireEvent.dragOver(screen.getByTestId('font-row-a'));
    fireEvent.drop(screen.getByTestId('font-row-a'));

    await waitFor(() => expect(fontsApi.reorderFonts).toHaveBeenCalledWith('cat-t', ['c', 'a', 'b']));
    expect(await titles()).toEqual(['Charlie Italic', 'Alpha Regular', 'Bravo Bold']);
  });

  it("puts the order back and shows the server's reason when saving fails", async () => {
    vi.mocked(fontsApi.reorderFonts).mockRejectedValueOnce(new Error('The list changed. Reload and try again.'));
    renderOrder();
    await titles();

    await userEvent.click(screen.getByRole('button', { name: 'Move Alpha Regular down' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith('The list changed. Reload and try again.', 'error'));
    expect(await titles()).toEqual(['Alpha Regular', 'Bravo Bold', 'Charlie Italic']);
  });

  it('explains how to start when there is no Trending category', async () => {
    vi.mocked(categoriesApi.fetchTree).mockResolvedValue([]);
    renderOrder();

    expect(await screen.findByText(/no Trending category yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Categories' })).toHaveAttribute('href', '/fonts/categories');
    expect(fontsApi.fetchFontOrder).not.toHaveBeenCalled();
  });

  it('warns that the app shows nothing while Trending is hidden', async () => {
    vi.mocked(categoriesApi.fetchTree).mockResolvedValue([{ ...TRENDING, isActive: false }]);
    renderOrder();
    expect(await screen.findByText(/Trending is hidden, so the app shows no fonts/)).toBeInTheDocument();
  });

  it('says how to fill an empty Trending', async () => {
    vi.mocked(fontsApi.fetchFontOrder).mockResolvedValue([]);
    renderOrder();
    expect(await screen.findByText(/No fonts in Trending yet/)).toBeInTheDocument();
  });
});
