import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { removeCover } from '@/lib/api/assets';
import { uploadCover } from '@/lib/upload/cover';
import { CoverPanel } from './cover-panel';

vi.mock('@/lib/upload/cover', () => ({ uploadCover: vi.fn() }));
vi.mock('@/lib/api/assets', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/assets')>('@/lib/api/assets')),
  removeCover: vi.fn(),
}));

function renderPanel(coverUrl: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const utils = render(
    <QueryClientProvider client={client}>
      <CoverPanel assetId="a1" coverUrl={coverUrl} />
    </QueryClientProvider>,
  );
  return { invalidate, ...utils };
}

const PNG = new File(['png'], 'cover.png', { type: 'image/png' });

beforeEach(() => {
  vi.mocked(uploadCover).mockReset();
  vi.mocked(removeCover).mockReset();
});

describe('CoverPanel', () => {
  it('without a cover shows the fallback tile and "Add cover"', () => {
    const { container } = renderPanel(null);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add cover' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('accepts only the image types the server takes', () => {
    renderPanel(null);
    expect(screen.getByLabelText('Cover image file')).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
  });

  it('uploads the chosen file as the cover and refreshes the sound', async () => {
    vi.mocked(uploadCover).mockResolvedValue();
    const { invalidate } = renderPanel(null);
    await userEvent.upload(screen.getByLabelText('Cover image file'), PNG);
    await vi.waitFor(() => expect(uploadCover).toHaveBeenCalledWith('a1', PNG));
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['assets'] }));
  });

  it('with a cover shows it, with Replace and Remove', async () => {
    vi.mocked(removeCover).mockResolvedValue();
    const { container } = renderPanel('https://cdn.test/slimshot/covers/c.png');
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/slimshot/covers/c.png');
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await vi.waitFor(() => expect(removeCover).toHaveBeenCalledWith('a1'));
  });

  it("shows the server's reason inline when the upload is refused", async () => {
    vi.mocked(uploadCover).mockRejectedValue(new Error('The file is not a supported image (JPEG, PNG or WebP).'));
    renderPanel(null);
    await userEvent.upload(screen.getByLabelText('Cover image file'), PNG);
    expect(await screen.findByRole('alert')).toHaveTextContent('The file is not a supported image (JPEG, PNG or WebP).');
  });
});
