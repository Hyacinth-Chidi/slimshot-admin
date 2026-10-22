import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import * as fontsApi from '@/lib/api/fonts';
import { LegacyChecklist } from './legacy-checklist';

const NAMES = [
  'Montserrat', 'Lato', 'Oswald', 'Bebas Neue', 'Playfair Display', 'Pacifico', 'Dancing Script', 'Poppins',
  'Raleway', 'Inter', 'Nunito', 'Lobster', 'Caveat', 'Abril Fatface', 'Righteous', 'Permanent Marker',
  'Press Start 2P', 'Cinzel', 'Sacramento',
];

vi.mock('@/lib/api/fonts', () => ({
  fetchLegacyFamilies: vi.fn(async () =>
    NAMES.map((familyName) => ({
      familyName,
      fontId: familyName === 'Montserrat' ? 'f-mont' : familyName === 'Oswald' ? 'f-osw' : null,
      published: familyName === 'Montserrat',
    })),
  ),
}));

function renderChecklist() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LegacyChecklist />
    </QueryClientProvider>,
  );
}

describe('LegacyChecklist', () => {
  it('lists the 19 families older projects use, each found or missing', async () => {
    renderChecklist();

    const list = await screen.findByRole('list', { name: 'Families in older projects' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => within(li).getByTestId('family').textContent)).toEqual(NAMES);
    expect(screen.getByText('1 of 19 ready')).toBeInTheDocument();
  });

  it('links a found family to its font, and says whether it is live', async () => {
    renderChecklist();

    const mont = (await screen.findByText('Montserrat')).closest('li')!;
    expect(within(mont).getByRole('link')).toHaveAttribute('href', '/fonts/f-mont');
    expect(mont).toHaveTextContent('Ready');

    const oswald = screen.getByText('Oswald').closest('li')!;
    expect(within(oswald).getByRole('link')).toHaveAttribute('href', '/fonts/f-osw');
    expect(oswald).toHaveTextContent('Not published');

    const lato = screen.getByText('Lato').closest('li')!;
    expect(within(lato).queryByRole('link')).toBeNull();
    expect(lato).toHaveTextContent('Missing');
  });

  it('shows a skeleton while it loads', async () => {
    vi.mocked(fontsApi.fetchLegacyFamilies).mockReturnValueOnce(new Promise(() => {}));
    renderChecklist();
    expect(screen.getByRole('status', { name: 'Loading older project fonts' })).toBeInTheDocument();
  });

  it('offers a retry when the checklist cannot load', async () => {
    vi.mocked(fontsApi.fetchLegacyFamilies).mockRejectedValueOnce(new Error('down'));
    renderChecklist();
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('1 of 19 ready')).toBeInTheDocument();
  });
});
