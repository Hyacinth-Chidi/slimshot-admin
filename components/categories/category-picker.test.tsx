import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTree, type Category } from '@/lib/api/categories';
import { CategoryPicker } from './category-picker';

vi.mock('@/lib/api/categories', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/categories')>('@/lib/api/categories')),
  fetchTree: vi.fn(),
}));

function cat(id: string, name: string, extra: Partial<Category> = {}): Category {
  return {
    id,
    kind: 'audio',
    parentId: null,
    slug: id,
    name,
    description: null,
    sortOrder: 0,
    isActive: true,
    children: [],
    ...extra,
  };
}

const TREE = [
  cat('sfx', 'Sound effects', {
    children: [
      cat('ui', 'UI', { parentId: 'sfx', children: [cat('ui-clicks', 'UI clicks', { parentId: 'ui' })] }),
      cat('soon', 'Coming soon', { parentId: 'sfx', isActive: false, sortOrder: 1 }),
    ],
  }),
];

function renderPicker(value: string | null = null) {
  const onChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CategoryPicker kind="audio" value={value} onChange={onChange} />
    </QueryClientProvider>,
  );
  return { onChange };
}

async function openPicker() {
  const trigger = screen.getByRole('combobox', { name: 'Category' });
  await vi.waitFor(() => expect(trigger).toBeEnabled());
  await userEvent.click(trigger);
}

beforeEach(() => {
  vi.mocked(fetchTree).mockReset();
});

describe('CategoryPicker', () => {
  it('offers "No category" first, then the real tree indented by depth, hidden ones marked', async () => {
    vi.mocked(fetchTree).mockResolvedValue(TREE);
    renderPicker();
    await openPicker();

    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'No category',
      'Sound effects',
      'UI',
      'UI clicks',
      'Coming soon (hidden)',
    ]);
    const indent = (name: string) =>
      Number.parseInt(
        (screen.getByRole('option', { name }).querySelector('span[style]') as HTMLElement).style.paddingLeft,
        10,
      );
    expect(indent('Sound effects')).toBe(0);
    expect(indent('UI')).toBeGreaterThan(0);
    expect(indent('UI clicks')).toBeGreaterThan(indent('UI'));
  });

  it('reports the chosen category id', async () => {
    vi.mocked(fetchTree).mockResolvedValue(TREE);
    const { onChange } = renderPicker();
    await openPicker();
    await userEvent.click(await screen.findByRole('option', { name: 'UI clicks' }));
    expect(onChange).toHaveBeenCalledWith('ui-clicks');
  });

  it('reports null for "No category"', async () => {
    vi.mocked(fetchTree).mockResolvedValue(TREE);
    const { onChange } = renderPicker('ui');
    await openPicker();
    await userEvent.click(await screen.findByRole('option', { name: 'No category' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('cannot be opened while the tree is loading', () => {
    vi.mocked(fetchTree).mockReturnValue(new Promise(() => {}));
    renderPicker();
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeDisabled();
  });
});
