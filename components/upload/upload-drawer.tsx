'use client';

import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UploadCloud } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchKinds, type Kind } from '@/lib/api/kinds';
import { flattenTree, fetchTree } from '@/lib/api/categories';
import { uploadFile } from '@/lib/upload/queue';
import { addFiles, queueReducer, type QueueAction, type QueueItem } from '@/lib/upload/reducer';
import { UploadRow } from './upload-row';

/**
 * Runs one item's full ticket -> direct-upload -> finalize sequence and
 * dispatches its state transitions. A rejected item is never passed here —
 * it never reaches uploadFile at all (R9a).
 */
async function runItem(
  item: QueueItem,
  dispatch: React.Dispatch<QueueAction>,
  onDone: () => void,
) {
  try {
    const result = await uploadFile(
      item.file,
      {
        kind: item.kind,
        title: item.title,
        author: item.author || undefined,
        categoryId: item.categoryId,
      },
      { onState: (state) => dispatch({ type: 'STATE', id: item.id, state }) },
    );
    dispatch({ type: 'DONE', id: item.id, assetId: result.assetId, assetStatus: result.status });
    onDone();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed.';
    dispatch({ type: 'FAILED', id: item.id, error: message });
  }
}

function DropZone({
  onFiles,
  acceptExtensions,
}: {
  onFiles: (files: File[]) => void;
  acceptExtensions: string[];
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center transition-colors duration-150 ease-out ${
        dragging ? 'border-[var(--brand-from)] bg-elevated' : 'border-border'
      }`}
    >
      <UploadCloud className="size-6 text-muted" aria-hidden="true" />
      <p className="text-sm text-muted">Drag files here, or</p>
      <Button
        type="button"
        variant="secondary"
        onClick={() => inputRef.current?.click()}
      >
        Choose files
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptExtensions.join(',')}
        className="sr-only"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function UploadDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(queueReducer, { items: [] });

  const kindsQuery = useQuery({ queryKey: ['kinds'], queryFn: fetchKinds, enabled: open });
  const kinds: Kind[] = useMemo(() => kindsQuery.data ?? [], [kindsQuery.data]);
  const [selectedKind, setSelectedKind] = useState<string | undefined>(undefined);
  const activeKind = selectedKind ?? kinds[0]?.kind;

  const categoriesQuery = useQuery({
    queryKey: ['categories', activeKind],
    queryFn: () => fetchTree(activeKind!),
    enabled: open && !!activeKind,
  });
  const flatCategories = useMemo(
    () => flattenTree(categoriesQuery.data ?? []),
    [categoriesQuery.data],
  );

  const acceptedExtensions = useMemo(
    () => kinds.find((k) => k.kind === activeKind)?.extensions ?? [],
    [kinds, activeKind],
  );

  const invalidateOnSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['assets'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  }, [queryClient]);

  const handleFiles = useCallback(
    (files: File[]) => {
      if (!activeKind || files.length === 0) return;
      const action = addFiles(files, activeKind, acceptedExtensions);
      dispatch(action);

      // Each accepted file starts its own ticket/upload/finalize sequence
      // immediately and independently — a failure in one never blocks or
      // aborts the others (spec §6.3).
      for (const item of action.items) {
        if (item.status !== 'queued') continue;
        void runItem(item, dispatch, invalidateOnSuccess);
      }
    },
    [activeKind, acceptedExtensions, invalidateOnSuccess],
  );

  const handleRetry = useCallback(
    (item: QueueItem) => {
      dispatch({ type: 'RETRY', id: item.id });
      void runItem({ ...item, status: 'queued', error: undefined }, dispatch, invalidateOnSuccess);
    },
    [invalidateOnSuccess],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-lg flex max-h-[85vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Upload</DialogTitle>
          <DialogDescription>
            Each file gets its own ticket, upload and finalize — one failure won&apos;t stop the rest.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 overflow-y-auto px-1">
          {kinds.length > 1 && (
            <Select value={activeKind} onValueChange={setSelectedKind}>
              <SelectTrigger aria-label="Kind">
                <SelectValue placeholder="Choose a kind" />
              </SelectTrigger>
              <SelectContent>
                {kinds.map((k) => (
                  <SelectItem key={k.kind} value={k.kind}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {activeKind ? (
            <DropZone onFiles={handleFiles} acceptExtensions={acceptedExtensions} />
          ) : (
            <p className="text-sm text-subtle">Loading upload kinds…</p>
          )}

          <div className="flex flex-col gap-2">
            {state.items.map((item) => (
              <UploadRow
                key={item.id}
                item={item}
                categories={flatCategories}
                onEdit={(fields) => dispatch({ type: 'EDIT', id: item.id, fields })}
                onRetry={() => handleRetry(item)}
                onRemove={() => dispatch({ type: 'REMOVE', id: item.id })}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
