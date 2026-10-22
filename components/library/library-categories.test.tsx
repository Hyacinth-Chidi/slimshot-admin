import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { LibraryCategories } from './library-categories';

vi.mock('next/navigation', () => ({ usePathname: () => '/audio/categories' }));
vi.mock('@/lib/api/kinds', () => ({
  fetchKinds: vi.fn(async () => [
    { kind: 'audio', label: 'Audio', extensions: ['.mp3'], fileRoles: [] },
    { kind: 'font', label: 'Font', extensions: ['.ttf', '.otf'], fileRoles: [] },
  ]),
}));
vi.mock('@/lib/api/categories', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/categories')>('@/lib/api/categories')),
  fetchTree: vi.fn(async () => []),
}));

function renderFor(kind: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LibraryCategories kind={kind} />
    </QueryClientProvider>,
  );
}

describe('LibraryCategories empty state', () => {
  it('still names Sound effects and Music for audio', async () => {
    renderFor('audio');
    expect(await screen.findByText(/"Sound effects" or "Music"/)).toBeInTheDocument();
    expect(screen.getByText(/sub-categories as the pills/)).toBeInTheDocument();
  });
});
