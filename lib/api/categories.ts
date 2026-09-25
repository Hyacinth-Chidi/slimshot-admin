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
 * `{ deleted: true }`.
 *
 * Originally brought in early (Task 9) for an upload-row category picker;
 * that picker was removed (Task 9 review, R9e) because no ingest DTO accepts
 * a categoryId — see lib/upload/queue.ts. This file now exists solely as
 * Task 10's Step 1 groundwork for the categories screen.
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
