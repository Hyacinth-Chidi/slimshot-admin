'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ChevronDown, ChevronRight, GripVertical, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/cn';
import type { Category } from '@/lib/api/categories';

/**
 * R10b: reorder is native HTML5 drag-and-drop on desktop PLUS 44px
 * move-up/move-down buttons, because HTML5 DnD never fires on touch. Both
 * paths call the same `onMove`/`onDrop` callbacks so the parent owns one
 * reorder computation (lib/categories/tree-helpers.ts's moveSibling).
 */
export function CategoryRow({
  category,
  depth,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDropOnto,
  onRename,
  onAddChild,
  onDelete,
  onToggleActive,
  onTogglePending,
  children,
}: {
  category: Category;
  depth: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: (id: string) => void;
  onDropOnto: (id: string) => void;
  onRename: (name: string) => void;
  onAddChild: () => void;
  onDelete: () => void;
  onToggleActive: (isActive: boolean) => void;
  onTogglePending?: boolean;
  children?: React.ReactNode;
}) {
  const hasChildren = Boolean(category.children && category.children.length > 0);
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(category.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  function startRename() {
    setDraft(category.name);
    setRenaming(true);
  }

  function commitRename() {
    const trimmed = draft.trim();
    setRenaming(false);
    if (trimmed && trimmed !== category.name) onRename(trimmed);
  }

  function cancelRename() {
    setDraft(category.name);
    setRenaming(false);
  }

  return (
    <li>
      <div
        data-testid={`category-row-${category.id}`}
        draggable
        onDragStart={() => onDragStart(category.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          onDropOnto(category.id);
        }}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors duration-150 ease-out hover:border-border hover:bg-elevated',
          !category.isActive && 'opacity-50 text-muted',
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <GripVertical
          className="hidden size-4 shrink-0 cursor-grab text-subtle md:block"
          aria-hidden
        />

        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            className="flex size-6 shrink-0 items-center justify-center text-muted"
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}

        {renaming ? (
          <Input
            ref={inputRef}
            aria-label="Name"
            // UpdateCategoryDto: @MaxLength(80) on name.
            maxLength={80}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') cancelRename();
            }}
            className="h-9 flex-1 md:h-8"
          />
        ) : (
          <span
            onDoubleClick={startRename}
            className={cn('flex-1 truncate text-sm text-text', !category.isActive && 'text-muted')}
          >
            {category.name}
          </span>
        )}

        <div className="hidden shrink-0 items-center gap-1 md:flex">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label={`Move ${category.name} up`}
            disabled={isFirst}
            onClick={onMoveUp}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label={`Move ${category.name} down`}
            disabled={isLast}
            onClick={onMoveDown}
          >
            ↓
          </Button>
        </div>
        {/* Below md: 44px move targets replace the desktop pair, since HTML5
            drag-and-drop never fires on touch (R10b). */}
        <div className="flex shrink-0 items-center gap-1 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="h-11 w-11 p-0"
            aria-label={`Move ${category.name} up`}
            disabled={isFirst}
            onClick={onMoveUp}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-11 w-11 p-0"
            aria-label={`Move ${category.name} down`}
            disabled={isLast}
            onClick={onMoveDown}
          >
            ↓
          </Button>
        </div>

        <Switch
          checked={category.isActive}
          onCheckedChange={onToggleActive}
          disabled={onTogglePending}
          aria-label={`${category.isActive ? 'Deactivate' : 'Activate'} ${category.name}`}
        />

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-11 w-11 p-0 md:h-8 md:w-8"
              aria-label={`Actions for ${category.name}`}
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={startRename}>Rename</DropdownMenuItem>
            <DropdownMenuItem onSelect={onAddChild}>Add child</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasChildren && expanded && <ul>{children}</ul>}
    </li>
  );
}
