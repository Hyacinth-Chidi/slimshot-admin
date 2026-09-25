import { apiFetch } from './client';
import { withRefresh } from '@/lib/auth/session';

/**
 * From task-10-brief.md Step 1, verified against the server's CategoryService
 * (../slimshot_server/src/modules/taxonomy/category.service.ts) and
 * AdminCategoriesController
 * (../slimshot_server/src/modules/admin/admin-categories.controller.ts):
 * `tree()` returns nested `CategoryNode[]` (children inline, not a flat list
 * with parentId to reassemble), reorder's body is `{ items: [{ id,
 * sortOrder }] }` (ReorderCategoriesDto), and delete returns
 * `{ deleted: true }`. Brought in early (Task 9, R9d) so the upload row's
 * category picker can call fetchTree(kind); Task 10 builds the rest of the
 * screen against the same file.
 */
export interface Category {
  id: string;
  kind: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  children?: Category[];
}

export function fetchTree(kind: string): Promise<Category[]> {
  return withRefresh(() => apiFetch<Category[]>(`/categories?kind=${encodeURIComponent(kind)}`));
}

export function createCategory(input: {
  kind: string;
  name: string;
  parentId?: string;
}): Promise<Category> {
  return withRefresh(() =>
    apiFetch<Category>('/categories', { method: 'POST', body: JSON.stringify(input) }),
  );
}

export function updateCategory(
  id: string,
  input: { name?: string; isActive?: boolean },
): Promise<Category> {
  return withRefresh(() =>
    apiFetch<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  );
}

export function reorderCategories(items: { id: string; sortOrder: number }[]): Promise<unknown> {
  return withRefresh(() =>
    apiFetch('/categories/reorder', { method: 'POST', body: JSON.stringify({ items }) }),
  );
}

export function deleteCategory(id: string): Promise<unknown> {
  return withRefresh(() => apiFetch(`/categories/${id}`, { method: 'DELETE' }));
}

/**
 * The upload row's category picker (R9d) needs a flat, kind-scoped list, not
 * the nested tree — flattened depth-first so a child still reads near its
 * parent when rendered as a simple list.
 */
export function flattenTree(nodes: Category[], depth = 0): { category: Category; depth: number }[] {
  return nodes.flatMap((node) => [
    { category: node, depth },
    ...flattenTree(node.children ?? [], depth + 1),
  ]);
}
