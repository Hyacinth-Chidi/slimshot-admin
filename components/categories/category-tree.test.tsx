import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Category } from '@/lib/api/categories';
import * as categoriesApi from '@/lib/api/categories';
import * as kindsApi from '@/lib/api/kinds';
import { ApiError } from '@/lib/api/client';
import * as toastModule from '@/lib/use-toast';
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

vi.mock('@/lib/api/kinds', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/kinds')>('@/lib/api/kinds');
  return { ...actual, fetchKinds: vi.fn() };
});

vi.mock('@/lib/use-toast', async () => {
  const actual = await vi.importActual<typeof import('@/lib/use-toast')>('@/lib/use-toast');
  return { ...actual, toast: vi.fn() };
});

const AUDIO_KIND = { kind: 'audio', label: 'Audio', extensions: [], fileRoles: [] };

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
  vi.mocked(kindsApi.fetchKinds).mockResolvedValue([AUDIO_KIND]);
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

describe('CategoryTree kind gating (kinds come from GET /kinds, never hardcoded)', () => {
  function renderUngated(props: { kind?: string } = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    return render(<CategoryTree {...props} />, { wrapper: Wrapper });
  }

  it('does not fetch the tree while /kinds is still pending', async () => {
    vi.mocked(categoriesApi.fetchTree).mockResolvedValue([]);
    let resolveKinds!: (v: typeof AUDIO_KIND[]) => void;
    vi.mocked(kindsApi.fetchKinds).mockReturnValue(
      new Promise((resolve) => {
        resolveKinds = resolve;
      }),
    );

    renderUngated();

    // Give any stray microtask a chance to fire before asserting the negative.
    await new Promise((r) => setTimeout(r, 10));
    expect(categoriesApi.fetchTree).not.toHaveBeenCalled();

    resolveKinds([AUDIO_KIND]);
    await waitFor(() => expect(categoriesApi.fetchTree).toHaveBeenCalledWith('audio'));
  });

  it('fetches the tree for the first loaded kind once /kinds resolves, with no initial kind given', async () => {
    vi.mocked(categoriesApi.fetchTree).mockResolvedValue([]);
    vi.mocked(kindsApi.fetchKinds).mockResolvedValue([
      { kind: 'font', label: 'Font', extensions: [], fileRoles: [] },
    ]);

    renderUngated();

    await waitFor(() => expect(categoriesApi.fetchTree).toHaveBeenCalledWith('font'));
  });

  it('falls back to the first loaded kind when the given initialKind is not among the loaded kinds', async () => {
    vi.mocked(categoriesApi.fetchTree).mockResolvedValue([]);
    vi.mocked(kindsApi.fetchKinds).mockResolvedValue([
      { kind: 'font', label: 'Font', extensions: [], fileRoles: [] },
    ]);

    renderUngated({ kind: 'template' });

    await waitFor(() => expect(categoriesApi.fetchTree).toHaveBeenCalledWith('font'));
    expect(categoriesApi.fetchTree).not.toHaveBeenCalledWith('template');
  });

  it('uses initialKind once it is among the loaded kinds', async () => {
    vi.mocked(categoriesApi.fetchTree).mockResolvedValue([]);
    vi.mocked(kindsApi.fetchKinds).mockResolvedValue([
      { kind: 'font', label: 'Font', extensions: [], fileRoles: [] },
      { kind: 'audio', label: 'Audio', extensions: [], fileRoles: [] },
    ]);

    renderUngated({ kind: 'audio' });

    await waitFor(() => expect(categoriesApi.fetchTree).toHaveBeenCalledWith('audio'));
  });

  it('shows an empty state instead of fetching when kinds load empty', async () => {
    vi.mocked(categoriesApi.fetchTree).mockResolvedValue([]);
    vi.mocked(kindsApi.fetchKinds).mockResolvedValue([]);

    renderUngated();

    await screen.findByText(/no kinds/i);
    expect(categoriesApi.fetchTree).not.toHaveBeenCalled();
  });
});

/**
 * I2: the server sends a class-validator 422's `details` as a flat string[]
 * (http-exception.filter.ts:75-80), e.g. CreateCategoryDto's @MaxLength(80).
 * The earlier inline parser expected `{ field: string[] }`, skipped the toast
 * for every 422 and found no field, so a rejected create showed nothing.
 */
function validation422(details: string[]) {
  return new ApiError(
    { code: 'VALIDATION_FAILED', message: 'Request validation failed.', details, traceId: 't' },
    422,
  );
}

describe('CategoryTree 422 handling', () => {
  beforeEach(() => {
    vi.mocked(toastModule.toast).mockClear();
    vi.mocked(categoriesApi.createCategory).mockReset();
    vi.mocked(categoriesApi.updateCategory).mockReset();
  });

  async function openCreate(user: ReturnType<typeof userEvent.setup>) {
    renderTree([cat({ id: 'p1', name: 'Nature' })]);
    await screen.findByTestId('category-row-p1');
    await user.click(screen.getByRole('button', { name: /new category/i }));
    return screen.getByLabelText(/name/i);
  }

  it("shows a create 422's name message under the Name field", async () => {
    const user = userEvent.setup();
    vi.mocked(categoriesApi.createCategory).mockRejectedValue(
      validation422(['name must be shorter than or equal to 80 characters']),
    );
    const input = await openCreate(user);
    await user.type(input, 'Thunder');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(
      await screen.findByText('name must be shorter than or equal to 80 characters'),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(toastModule.toast).not.toHaveBeenCalled();
  });

  it('toasts a create 422 that names no field the dialog shows', async () => {
    const user = userEvent.setup();
    vi.mocked(categoriesApi.createCategory).mockRejectedValue(
      validation422(['parentId must be a string']),
    );
    const input = await openCreate(user);
    await user.type(input, 'Thunder');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() =>
      expect(toastModule.toast).toHaveBeenCalledWith('parentId must be a string', 'error'),
    );
  });

  it('caps the create Name input at the DTO limit of 80 characters', async () => {
    const user = userEvent.setup();
    const input = await openCreate(user);
    expect(input).toHaveAttribute('maxLength', '80');
  });

  it("toasts a rename 422's own message rather than the generic envelope message", async () => {
    const user = userEvent.setup();
    vi.mocked(categoriesApi.updateCategory).mockRejectedValue(
      validation422(['name must be shorter than or equal to 80 characters']),
    );
    renderTree([cat({ id: 'p1', name: 'Nature' })]);

    const row = await screen.findByTestId('category-row-p1');
    await user.dblClick(within(row).getByText('Nature'));
    const input = within(row).getByRole('textbox', { name: /name/i });
    expect(input).toHaveAttribute('maxLength', '80');
    await user.clear(input);
    await user.type(input, 'Renamed{Enter}');

    await waitFor(() =>
      expect(toastModule.toast).toHaveBeenCalledWith(
        'name must be shorter than or equal to 80 characters',
        'error',
      ),
    );
  });
});
