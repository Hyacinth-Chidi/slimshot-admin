'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
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
import { startItems } from '@/lib/upload/orchestrator';
import { addFiles, queueReducer, type QueueItem } from '@/lib/upload/reducer';
import { UploadRow } from './upload-row';

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
  // A ref mirror of `state`, so orchestrator code started from an event
  // handler can always read the CURRENT queue (including edits made after
  // the handler fired) rather than closing over the state a stale render
  // saw. Written in an effect, not during render: react-hooks/refs forbids
  // a ref write in the render body itself.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const kindsQuery = useQuery({ queryKey: ['kinds'], queryFn: fetchKinds, enabled: open });
  const kinds: Kind[] = useMemo(() => kindsQuery.data ?? [], [kindsQuery.data]);
  const [selectedKind, setSelectedKind] = useState<string | undefined>(undefined);
  const activeKind = selectedKind ?? kinds[0]?.kind;

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
      // R9f: newly added files stay `queued` — nothing starts automatically.
      // Each row gets its own "Upload" action, and the drawer offers
      // "Upload all" below, so title/author can be edited first.
      dispatch(addFiles(files, activeKind, acceptedExtensions));
    },
    [activeKind, acceptedExtensions],
  );

  const runOne = useCallback(
    (item: QueueItem) => {
      void startItems([item], dispatch, () => stateRef.current, invalidateOnSuccess);
    },
    [invalidateOnSuccess],
  );

  const handleRetry = useCallback(
    (item: QueueItem) => {
      dispatch({ type: 'RETRY', id: item.id });
      // startItems re-reads the item from the store once it's actually
      // `queued` again, so it picks up the just-dispatched RETRY rather than
      // racing it.
      void startItems([item], dispatch, () => stateRef.current, invalidateOnSuccess);
    },
    [invalidateOnSuccess],
  );

  const queuedItems = state.items.filter((item) => item.status === 'queued');

  const handleUploadAll = useCallback(() => {
    void startItems(queuedItems, dispatch, () => stateRef.current, invalidateOnSuccess);
  }, [queuedItems, invalidateOnSuccess]);

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

          {queuedItems.length > 1 && (
            <Button variant="secondary" onClick={handleUploadAll} className="self-end">
              Upload all ({queuedItems.length})
            </Button>
          )}

          <div className="flex flex-col gap-2">
            {state.items.map((item) => (
              <UploadRow
                key={item.id}
                item={item}
                onEdit={(fields) => dispatch({ type: 'EDIT', id: item.id, fields })}
                onStart={() => runOne(item)}
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
