import type { Category } from '@/lib/api/categories';

/**
 * The server's `GET /categories` already nests children inline (Task 9's
 * verified read of category.service.ts `tree()` — every node built there
 * carries `children`, even an empty array for a leaf). This helper exists as
 * a defensive fallback per the brief's ruling 6 ("if the server returns a
 * flat list rather than nested children, build the tree client-side"): if
 * any node in the input lacks a `children` array, the whole list is treated
 * as flat and reassembled from `parentId`. A category whose parentId points
 * at nothing in the list (a stale reference, or a page that only fetched
 * part of the tree) is kept as a root rather than silently dropped.
 */
export function buildTree(categories: Category[]): Category[] {
  const alreadyNested = categories.every((c) => Array.isArray(c.children));
  if (alreadyNested) {
    return [...categories].sort(bySortOrder);
  }

  const byId = new Map<string, Category & { children: Category[] }>();
  for (const c of categories) byId.set(c.id, { ...c, children: [] });

  const roots: (Category & { children: Category[] })[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  for (const node of byId.values()) node.children.sort(bySortOrder);
  return roots.sort(bySortOrder);
}

function bySortOrder(a: Category, b: Category): number {
  return a.sortOrder - b.sortOrder;
}

export type MoveDirection = 'up' | 'down';

/**
 * Computes the new sortOrders for a move within one sibling group (R10b:
 * reorder is sibling-only, never across parents). Returns null when the move
 * is a no-op (already first/last) so the caller can skip the mutation
 * entirely. sortOrders are re-numbered contiguously from 0 on every move —
 * the input's own values may have gaps (e.g. after a delete), and the API
 * has no notion of "insert between" sort keys, so a full renumber of the
 * sibling group is the simplest thing that stays correct.
 */
export function moveSibling(
  siblings: Category[],
  id: string,
  direction: MoveDirection,
): { id: string; sortOrder: number }[] | null {
  const ordered = [...siblings].sort(bySortOrder);
  const index = ordered.findIndex((c) => c.id === id);
  if (index === -1) return null;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) return null;

  const reordered = [...ordered];
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

  return reordered.map((c, i) => ({ id: c.id, sortOrder: i }));
}
