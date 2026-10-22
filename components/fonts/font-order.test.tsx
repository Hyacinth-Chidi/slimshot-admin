import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fontsApi from '@/lib/api/fonts';
import { toast } from '@/lib/use-toast';
import { FontOrder } from './font-order';

const ROWS = [
  { id: 'a', title: 'Alpha Regular', styleName: 'Regular', previewUrl: 'https://cdn.test/a.png', status: 'published' as const },
  { id: 'b', title: 'Bravo Bold', styleName: 'Bold', previewUrl: 'https://cdn.test/b.png', status: 'published' as const },
  { id: 'c', title: 'Charlie Italic', styleName: 'Italic', previewUrl: null, status: 'published' as const },
];

vi.mock('@/lib/api/fonts', () => ({ fetchFontOrder: vi.fn(), reorderFonts: vi.fn() }));
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

beforeEach(() => {
  vi.mocked(fontsApi.fetchFontOrder).mockReset().mockResolvedValue(ROWS);
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
  const list = await screen.findByRole('list', { name: 'Font order' });
  return within(list)
    .getAllByRole('listitem')
    .map((li) => within(li).getByTestId('font-title').textContent);
}

describe('FontOrder', () => {
  it('lists every published font by position, with its preview', async () => {
    renderOrder();

    expect(await titles()).toEqual(['Alpha Regular', 'Bravo Bold', 'Charlie Italic']);
    expect(fontsApi.fetchFontOrder).toHaveBeenCalledWith();
    const first = screen.getAllByRole('listitem')[0];
    expect(first).toHaveTextContent('1');
    expect(within(first).getByRole('img', { name: 'Alpha Regular preview' })).toBeInTheDocument();
    expect(screen.queryByText(/Trending/)).toBeNull();
  });

  it('moves a font with Move up and Move down, saving the whole new order', async () => {
    renderOrder();
    await titles();

    await userEvent.click(screen.getByRole('button', { name: 'Move Alpha Regular down' }));
    expect(fontsApi.reorderFonts).toHaveBeenCalledWith(['b', 'a', 'c']);
    expect(await titles()).toEqual(['Bravo Bold', 'Alpha Regular', 'Charlie Italic']);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Move Charlie Italic up' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Move Charlie Italic up' }));
    expect(fontsApi.reorderFonts).toHaveBeenLastCalledWith(['b', 'c', 'a']);
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

    await waitFor(() => expect(fontsApi.reorderFonts).toHaveBeenCalledWith(['c', 'a', 'b']));
    expect(await titles()).toEqual(['Charlie Italic', 'Alpha Regular', 'Bravo Bold']);
  });

  it("puts the order back and shows the server's reason when saving fails", async () => {
    vi.mocked(fontsApi.reorderFonts).mockRejectedValueOnce(
      new Error('The published fonts changed. Reload the order and try again.'),
    );
    renderOrder();
    await titles();

    await userEvent.click(screen.getByRole('button', { name: 'Move Alpha Regular down' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('The published fonts changed. Reload the order and try again.', 'error'),
    );
    expect(await titles()).toEqual(['Alpha Regular', 'Bravo Bold', 'Charlie Italic']);
  });

  it('says how to fill an empty order', async () => {
    vi.mocked(fontsApi.fetchFontOrder).mockResolvedValue([]);
    renderOrder();
    expect(await screen.findByText(/No published fonts yet/)).toBeInTheDocument();
  });

  it('shows a skeleton while it loads, and a retry when it fails', async () => {
    vi.mocked(fontsApi.fetchFontOrder).mockRejectedValueOnce(new Error('down'));
    renderOrder();
    expect(screen.getByRole('status', { name: 'Loading font order' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await titles()).toEqual(['Alpha Regular', 'Bravo Bold', 'Charlie Italic']);
  });
});
