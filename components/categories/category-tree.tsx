'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/lib/use-toast';
import { ApiError } from '@/lib/api/client';
import {
  createCategory,
  deleteCategory,
  fetchTree,
  reorderCategories,
  updateCategory,
  type Category,
} from '@/lib/api/categories';
import { fetchKinds } from '@/lib/api/kinds';
import { buildTree, moveSibling } from '@/lib/categories/tree-helpers';
import { CategoryRow } from './category-row';
import { CreateCategoryDialog } from './create-category-dialog';
import { DeleteDialog } from './delete-dialog';

/**
 * Minimal inline mapping of a 422's `details` (spec §9: "map details onto the
 * offending form fields") onto the create dialog's Name field. Task 11 is
 * where a shared `lib/api/field-errors.ts` helper is planned to land for
 * every form on the dashboard; duplicating that shape here for one field
 * would either diverge from it or require guessing its exact contract ahead
 * of that task, so this stays a local one-off until Task 11 introduces the
 * shared version for every screen to adopt at once.
 */
function fieldErrorsFrom(error: unknown): Record<string, string[]> | undefined {
  if (error instanceof ApiError && error.status === 422) return error.details;
  return undefined;
}

function findParent(tree: Category[], id: string): Category | null {
  for (const node of tree) {
    if (node.children?.some((c) => c.id === id)) return node;
    const nested = findParent(node.children ?? [], id);
    if (nested) return nested;
  }
  return null;
}

function siblingsOf(tree: Category[], id: string): Category[] {
  const parent = findParent(tree, id);
  return parent ? (parent.children ?? []) : tree;
}

export function CategoryTree({ kind: initialKind }: { kind?: string }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState(initialKind ?? 'audio');
  const [createTarget, setCreateTarget] = useState<{ parentId?: string; parentName?: string } | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<ApiError | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const kindsQuery = useQuery({ queryKey: ['kinds'], queryFn: fetchKinds });
  const treeQuery = useQuery({
    queryKey: ['categories', kind],
    queryFn: () => fetchTree(kind),
  });

  function invalidateTree() {
    queryClient.invalidateQueries({ queryKey: ['categories', kind] });
  }

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      invalidateTree();
      setCreateTarget(null);
    },
    onError: (error) => {
      if (!(error instanceof ApiError) || error.status !== 422) {
        toast(error instanceof Error ? error.message : 'Could not create category.', 'error');
      }
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateCategory(id, { name }),
    onSuccess: invalidateTree,
    onError: (error) => {
      toast(error instanceof Error ? error.message : 'Could not rename category.', 'error');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateCategory(id, { isActive }),
    onSuccess: invalidateTree,
    onError: (error) => {
      toast(error instanceof Error ? error.message : 'Could not update category.', 'error');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: reorderCategories,
    onSuccess: invalidateTree,
    onError: (error) => {
      toast(error instanceof Error ? error.message : 'Could not reorder categories.', 'error');
      invalidateTree();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      invalidateTree();
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setDeleteError(error);
      } else {
        toast(error instanceof Error ? error.message : 'Could not delete category.', 'error');
        setDeleteTarget(null);
      }
    },
  });

  const tree = buildTree(treeQuery.data ?? []);

  function runMove(id: string, direction: 'up' | 'down') {
    const siblings = siblingsOf(tree, id);
    const result = moveSibling(siblings, id, direction);
    if (result) reorderMutation.mutate(result);
  }

  function runDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const siblings = siblingsOf(tree, dragId);
    if (!siblings.some((c) => c.id === targetId)) {
      // Cross-parent drops are out of scope (R10b: sibling-only reorder).
      setDragId(null);
      return;
    }
    const ordered = [...siblings].sort((a, b) => a.sortOrder - b.sortOrder);
    const fromIndex = ordered.findIndex((c) => c.id === dragId);
    const toIndex = ordered.findIndex((c) => c.id === targetId);
    const next = [...ordered];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    reorderMutation.mutate(next.map((c, i) => ({ id: c.id, sortOrder: i })));
    setDragId(null);
  }

  function renderNodes(nodes: Category[], depth: number) {
    return nodes.map((node, index) => (
      <CategoryRow
        key={node.id}
        category={node}
        depth={depth}
        isFirst={index === 0}
        isLast={index === nodes.length - 1}
        onMoveUp={() => runMove(node.id, 'up')}
        onMoveDown={() => runMove(node.id, 'down')}
        onDragStart={setDragId}
        onDropOnto={runDrop}
        onRename={(name) => renameMutation.mutate({ id: node.id, name })}
        onAddChild={() => setCreateTarget({ parentId: node.id, parentName: node.name })}
        onDelete={() => {
          setDeleteTarget(node);
          setDeleteError(null);
        }}
        onToggleActive={(isActive) => toggleActiveMutation.mutate({ id: node.id, isActive })}
        onTogglePending={toggleActiveMutation.isPending}
      >
        {node.children && node.children.length > 0 && renderNodes(node.children, depth + 1)}
      </CategoryRow>
    ));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-40" aria-label="Kind">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            {(kindsQuery.data ?? []).map((k) => (
              <SelectItem key={k.kind} value={k.kind}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="primary" onClick={() => setCreateTarget({})}>
          <Plus className="size-4" />
          New category
        </Button>
      </div>

      {treeQuery.isLoading ? (
        <p className="py-12 text-center text-sm text-subtle">Loading categories…</p>
      ) : tree.length === 0 ? (
        <p className="py-12 text-center text-sm text-subtle">No categories yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">{renderNodes(tree, 0)}</ul>
      )}

      <CreateCategoryDialog
        open={createTarget !== null}
        onOpenChange={(open) => !open && setCreateTarget(null)}
        parentName={createTarget?.parentName}
        pending={createMutation.isPending}
        fieldErrors={fieldErrorsFrom(createMutation.error)}
        onSubmit={(name) =>
          createMutation.mutate({ kind, name, parentId: createTarget?.parentId })
        }
      />

      <DeleteDialog
        open={deleteTarget !== null}
        name={deleteTarget?.name ?? ''}
        categoryId={deleteTarget?.id}
        error={deleteError}
        pending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
