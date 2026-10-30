'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { formatBytes } from '@/components/overview/stat-cards';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BACKUPS_KEY,
  deleteBackup,
  fetchBackupDownload,
  fetchRestoreCommand,
  type BackupItem,
} from '@/lib/api/backups';
import { ApiError } from '@/lib/api/client';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/use-toast';

type RestoreCommand = { command: string; expiresAt: string };

/** A signed-out session redirects on its own; anything else is said. */
function sayFailure(error: unknown) {
  if (error instanceof ApiError && error.status === 401) return;
  toast(error instanceof Error ? error.message : 'Something went wrong.', 'error');
}

const typeOf = (backup: BackupItem) => (backup.trigger === 'auto' ? 'Automatic' : 'Manual');

/**
 * The backups in the bucket, newest first, each with Download, Copy restore
 * command and Delete. Links are fetched only when asked for: each is a fresh
 * signed link, valid for minutes, and the server audits every one.
 */
export function BackupList({ backups, autoEnabled }: { backups: BackupItem[]; autoEnabled: boolean }) {
  const [restoring, setRestoring] = useState<BackupItem | null>(null);
  const [deleting, setDeleting] = useState<BackupItem | null>(null);

  const download = useMutation({
    mutationFn: (filename: string) => fetchBackupDownload(filename),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: sayFailure,
  });
  const restore = useMutation({ mutationFn: (filename: string) => fetchRestoreCommand(filename) });

  if (backups.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-12 text-center text-sm text-subtle">
        {autoEnabled ? 'No backups yet. The first automatic one runs at 03:15 UTC.' : 'No backups yet.'}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="py-2.5 pr-3 pl-4 font-medium md:pl-5">Date</th>
            <th className="py-2.5 pr-3 font-medium">Size</th>
            <th className="py-2.5 pr-3 font-medium">Type</th>
            <th className="w-12 py-2.5 pr-2" />
          </tr>
        </thead>
        <tbody>
          {backups.map((backup, index) => (
            <tr key={backup.filename} className="border-b border-border last:border-0">
              <td className="py-2 pr-3 pl-4 whitespace-nowrap text-text md:pl-5">{formatDateTime(backup.createdAt)}</td>
              <td className="py-2 pr-3 whitespace-nowrap text-muted tabular-nums">{formatBytes(backup.sizeBytes)}</td>
              <td className="py-2 pr-3 text-muted">{typeOf(backup)}</td>
              <td className="py-1 pr-2 text-right">
                <RowMenu
                  backup={backup}
                  newest={index === 0}
                  onDownload={() => download.mutate(backup.filename)}
                  onRestore={() => {
                    setRestoring(backup);
                    restore.mutate(backup.filename);
                  }}
                  onDelete={() => setDeleting(backup)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <RestoreDialog backup={restoring} state={restore} onClose={() => setRestoring(null)} />
      <DeleteDialog backup={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function RowMenu({
  backup,
  newest,
  onDownload,
  onRestore,
  onDelete,
}: {
  backup: BackupItem;
  newest: boolean;
  onDownload: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    // modal={false}: the items open Radix Dialogs; a modal menu closing as one opens can
    // leave the page unclickable (see asset-actions-menu.tsx).
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Actions for the backup from ${formatDateTime(backup.createdAt)}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuItem onSelect={onDownload}>Download</DropdownMenuItem>
        <DropdownMenuItem onSelect={onRestore}>Copy restore command…</DropdownMenuItem>
        {/* The reason sits in the item itself: a tooltip never opens on a disabled item, or on a phone. */}
        <DropdownMenuItem variant="destructive" disabled={newest} onSelect={onDelete}>
          <span className="flex flex-col gap-0.5">
            <span>Delete…</span>
            {newest && <span className="text-xs text-subtle">The newest backup can&apos;t be deleted</span>}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RestoreDialog({
  backup,
  state,
  onClose,
}: {
  backup: BackupItem | null;
  state: UseMutationResult<RestoreCommand, Error, string>;
  onClose: () => void;
}) {
  return (
    <Dialog open={backup !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Restore this backup</DialogTitle>
          <DialogDescription>
            {backup ? `${formatDateTime(backup.createdAt)} · ${typeOf(backup)}` : null}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed by backup: another backup's copy state never carries over. */}
        {backup && <RestoreBody key={backup.filename} state={state} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function RestoreBody({
  state,
  onClose,
}: {
  state: UseMutationResult<RestoreCommand, Error, string>;
  onClose: () => void;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'by-hand'>('idle');
  const command = state.data?.command ?? null;
  // No clipboard outside a secure context: the command stays selectable instead.
  const byHand = copy === 'by-hand' || typeof navigator === 'undefined' || !navigator.clipboard?.writeText;

  const select = () => {
    const pre = preRef.current;
    const selection = window.getSelection();
    if (!pre || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(pre);
    selection.removeAllRanges();
    selection.addRange(range);
  };
  const onCopy = async () => {
    if (!command) return;
    if (byHand) return select();
    try {
      await navigator.clipboard.writeText(command);
      setCopy('copied');
    } catch {
      setCopy('by-hand');
      select();
    }
  };

  return (
    <>
      {state.isPending ? (
        <Skeleton className="h-20 w-full rounded-lg" />
      ) : state.isError ? (
        <p role="alert" className="text-sm text-error">
          {state.error.message}
        </p>
      ) : command ? (
        <div className="flex flex-col gap-3">
          <pre
            ref={preRef}
            className="max-h-40 overflow-auto rounded-lg border border-border bg-elevated p-3 font-mono text-xs break-all whitespace-pre-wrap text-text select-all"
          >
            {command}
          </pre>
          <p className="text-xs text-subtle">Valid for 1 hour. Run it in the server&apos;s folder on the VPS.</p>
          <p className="text-sm text-muted">
            Restoring replaces everything written since this backup; the script asks you to type RESTORE and saves a
            safety copy first. To try it safely first, put <code className="font-mono whitespace-nowrap text-text">--check</code> after{' '}
            <code className="font-mono whitespace-nowrap text-text">restore-db.sh</code>.
          </p>
        </div>
      ) : null}
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" disabled={!command} onClick={() => void onCopy()}>
          {byHand ? 'Select the command and copy it' : copy === 'copied' ? 'Copied' : 'Copy'}
        </Button>
      </DialogFooter>
    </>
  );
}

function DeleteDialog({ backup, onClose }: { backup: BackupItem | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (filename: string) => deleteBackup(filename),
    onSuccess: () => toast('Backup deleted.'),
    onError: sayFailure,
    onSettled: () => {
      onClose();
      // Either way the list is read again: the bucket is the only record of what exists.
      void queryClient.invalidateQueries({ queryKey: BACKUPS_KEY });
    },
  });

  return (
    <Dialog open={backup !== null} onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <DialogContent role="alertdialog" showCloseButton={false} className="md:max-w-md">
        {backup ? (
          <>
            <DialogHeader>
              <DialogTitle>Delete the backup from {formatDateTime(backup.createdAt)}?</DialogTitle>
              <DialogDescription>It is removed from the bucket for good.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" disabled={mutation.isPending} onClick={onClose}>
                Cancel
              </Button>
              <Button variant="danger" disabled={mutation.isPending} onClick={() => mutation.mutate(backup.filename)}>
                {mutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
