import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Category } from '@/lib/api/categories';
import * as categoriesApi from '@/lib/api/categories';
import { CategoryTree } from './category-tree';

vi.mock('@/lib/api/categories', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/categories')>('@/lib/api/categories');
  return {
    ...actual,
    fetchTree: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    reorderCategories: vi.fn(),
    deleteCategory: vi.fn(),
  };
});

function cat(overrides: Partial<Category> & { id: string; name: string }): Category {
  return {
    kind: 'audio',
    parentId: null,
    slug: overrides.name.toLowerCase(),
    description: null,
    sortOrder: 0,
    isActive: true,
    children: [],
    ...overrides,
  };
}

function renderTree(tree: Category[], kind = 'audio') {
  vi.mocked(categoriesApi.fetchTree).mockResolvedValue(tree);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { ...render(<CategoryTree kind={kind} />, { wrapper: Wrapper }), client };
}

describe('CategoryTree nested rendering', () => {
  it('renders children nested under their parent', async () => {
    const tree = [
      cat({
        id: 'p1',
        name: 'Nature',
        children: [cat({ id: 'c1', name: 'Rain', parentId: 'p1' })],
      }),
    ];
    renderTree(tree);

    const parentRow = await screen.findByTestId('category-row-p1');
    expect(within(parentRow).getByText('Nature')).toBeInTheDocument();

    const childRow = screen.getByTestId('category-row-c1');
    expect(within(childRow).getByText('Rain')).toBeInTheDocument();
    // The child row is nested inside the parent's subtree container, not a
    // sibling of it at the top level.
    expect(parentRow.parentElement?.contains(childRow)).toBe(true);
  });

  it('visually mutes a category with isActive: false', async () => {
    const tree = [cat({ id: 'p1', name: 'Archived kind', isActive: false })];
    renderTree(tree);

    const row = await screen.findByTestId('category-row-p1');
    expect(row.className).toMatch(/opacity|muted|text-muted|text-subtle/);
  });
});

describe('CategoryTree add-child never offers a different-kind parent', () => {
  it('creates the child with the clicked row\'s own kind, never a kind picker', async () => {
    const user = userEvent.setup();
    vi.mocked(categoriesApi.createCategory).mockResolvedValue(
      cat({ id: 'new', name: 'New', kind: 'audio', parentId: 'p1' }),
    );
    const tree = [cat({ id: 'p1', name: 'Nature', kind: 'audio' })];
    renderTree(tree, 'audio');

    const row = await screen.findByTestId('category-row-p1');
    await user.click(within(row).getByRole('button', { name: /actions for nature/i }));
    await user.click(await screen.findByText(/add child/i));

    // The create dialog has no kind selector at all — the tree is kind-scoped
    // (spec §6.4: a parent of a different kind is never offered), so there is
    // nothing to choose between.
    expect(screen.queryByRole('combobox', { name: /kind/i })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/name/i), 'Thunder');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(categoriesApi.createCategory).toHaveBeenCalledWith(
      { kind: 'audio', name: 'Thunder', parentId: 'p1' },
      expect.anything(),
    );
  });
});

describe('CategoryTree rename', () => {
  it('sends only the changed field (name) to updateCategory', async () => {
    const user = userEvent.setup();
    vi.mocked(categoriesApi.updateCategory).mockResolvedValue(cat({ id: 'p1', name: 'Renamed' }));
    const tree = [cat({ id: 'p1', name: 'Nature', description: 'old desc', sortOrder: 3 })];
    renderTree(tree);

    const row = await screen.findByTestId('category-row-p1');
    await user.dblClick(within(row).getByText('Nature'));

    const input = within(row).getByRole('textbox', { name: /name/i });
    await user.clear(input);
    await user.type(input, 'Renamed{Enter}');

    expect(categoriesApi.updateCategory).toHaveBeenCalledWith('p1', { name: 'Renamed' });
    expect(categoriesApi.updateCategory).not.toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ description: expect.anything() }),
    );
  });

  it('does not call updateCategory when the name is unchanged on blur', async () => {
    const user = userEvent.setup();
    const tree = [cat({ id: 'p1', name: 'Nature' })];
    renderTree(tree);

    const row = await screen.findByTestId('category-row-p1');
    await user.dblClick(within(row).getByText('Nature'));
    const input = within(row).getByRole('textbox', { name: /name/i });
    input.blur();

    expect(categoriesApi.updateCategory).not.toHaveBeenCalled();
  });

  it('cancels the rename on Escape without calling updateCategory', async () => {
    const user = userEvent.setup();
    const tree = [cat({ id: 'p1', name: 'Nature' })];
    renderTree(tree);

    const row = await screen.findByTestId('category-row-p1');
    await user.dblClick(within(row).getByText('Nature'));
    const input = within(row).getByRole('textbox', { name: /name/i });
    await user.clear(input);
    await user.type(input, 'Something else{Escape}');

    expect(categoriesApi.updateCategory).not.toHaveBeenCalled();
    expect(within(row).getByText('Nature')).toBeInTheDocument();
  });
});
