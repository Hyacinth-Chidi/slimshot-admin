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
import { fieldErrors, validationSummary } from '@/lib/api/field-errors';
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

/** A 422's own messages rather than its generic envelope text; else the error's message. */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 422) return validationSummary(error);
  return error instanceof Error ? error.message : fallback;
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
  // The user's explicit choice from the Select, if any. Starts undefined —
  // until kinds load, there is nothing valid to select, and nothing to
  // derive a fetch from.
  const [selectedKind, setSelectedKind] = useState<string | undefined>(undefined);
  const [createTarget, setCreateTarget] = useState<{ parentId?: string; parentName?: string } | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<ApiError | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const kindsQuery = useQuery({ queryKey: ['kinds'], queryFn: fetchKinds });
  const loadedKinds = kindsQuery.data ?? [];

  // Derived, not synced via an effect (the repo's react-hooks lint rules
  // reject setState-in-effect — see create-category-dialog.tsx for the same
  // pattern). The active kind is: the user's own selection if it's still
  // among the loaded kinds; else the caller's initialKind if IT is among the
  // loaded kinds; else the first loaded kind; else undefined while kinds
  // haven't resolved yet (or resolved empty). Kinds always come from GET
  // /kinds — never hardcoded — so an invalid/empty kind, which the server
  // 422s on, is never sent.
  const activeKind =
    (selectedKind && loadedKinds.some((k) => k.kind === selectedKind) ? selectedKind : undefined) ??
    (initialKind && loadedKinds.some((k) => k.kind === initialKind) ? initialKind : undefined) ??
    loadedKinds[0]?.kind;

  const treeQuery = useQuery({
    queryKey: ['categories', activeKind],
    queryFn: () => fetchTree(activeKind as string),
    enabled: Boolean(activeKind),
  });

  function invalidateTree() {
    queryClient.invalidateQueries({ queryKey: ['categories', activeKind] });
  }

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      invalidateTree();
      setCreateTarget(null);
    },
    onError: (error) => {
      // A 422 about `name` is shown under the dialog's Name field (read off
      // createMutation.error below); any other failure, including a 422
      // about a field the dialog does not show, is toasted.
      if (fieldErrors(error).name) return;
      toast(errorMessage(error, 'Could not create category.'), 'error');
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateCategory(id, { name }),
    onSuccess: invalidateTree,
    onError: (error) => {
      // The inline rename has no error slot, so the field message is toasted.
      toast(fieldErrors(error).name ?? errorMessage(error, 'Could not rename category.'), 'error');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateCategory(id, { isActive }),
    onSuccess: invalidateTree,
    onError: (error) => {
      toast(errorMessage(error, 'Could not update category.'), 'error');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: reorderCategories,
    onSuccess: invalidateTree,
    onError: (error) => {
      toast(errorMessage(error, 'Could not reorder categories.'), 'error');
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
        toast(errorMessage(error, 'Could not delete category.'), 'error');
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
        <Select value={activeKind} onValueChange={setSelectedKind} disabled={loadedKinds.length === 0}>
          <SelectTrigger className="w-40" aria-label="Kind">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            {loadedKinds.map((k) => (
              <SelectItem key={k.kind} value={k.kind}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="primary" onClick={() => setCreateTarget({})} disabled={!activeKind}>
          <Plus className="size-4" />
          New category
        </Button>
      </div>

      {kindsQuery.isLoading ? (
        <p className="py-12 text-center text-sm text-subtle">Loading…</p>
      ) : loadedKinds.length === 0 ? (
        <p className="py-12 text-center text-sm text-subtle">
          No kinds are registered yet — categories need a kind to belong to.
        </p>
      ) : treeQuery.isLoading ? (
        <p className="py-12 text-center text-sm text-subtle">Loading categories…</p>
      ) : tree.length === 0 ? (
        <p className="py-12 text-center text-sm text-subtle">No categories yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">{renderNodes(tree, 0)}</ul>
      )}

      <CreateCategoryDialog
        open={createTarget !== null}
        onOpenChange={(open) => {
          if (open) return;
          setCreateTarget(null);
          // Drop the last attempt's error so it is not shown on the next open.
          createMutation.reset();
        }}
        parentName={createTarget?.parentName}
        pending={createMutation.isPending}
        nameError={fieldErrors(createMutation.error).name}
        onSubmit={(name) =>
          activeKind && createMutation.mutate({ kind: activeKind, name, parentId: createTarget?.parentId })
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
