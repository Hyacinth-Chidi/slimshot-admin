import type { UploadState } from './queue';

/**
 * `rejected` is a client-only terminal state for a file whose extension the
 * chosen kind doesn't accept — it never reaches uploadFile, so it never
 * enters the ticket/uploading/finalizing sequence at all.
 */
export type QueueItemStatus = UploadState | 'rejected';

export interface QueueItem {
  /** Stable local id, independent of any server id — assigned before a
   * ticket exists, so the row (and its Artwork placeholder, keyed on this)
   * has an identity from the moment it's dropped. */
  id: string;
  file: File;
  kind: string;
  title: string;
  author: string;
  status: QueueItemStatus;
  error?: string;
  assetId?: string;
  assetStatus?: string;
}

export interface QueueState {
  items: QueueItem[];
}

export type QueueAction =
  | { type: 'ADD'; items: QueueItem[] }
  | { type: 'STATE'; id: string; state: UploadState }
  | { type: 'DONE'; id: string; assetId: string; assetStatus: string }
  | { type: 'FAILED'; id: string; error: string }
  | { type: 'RETRY'; id: string }
  | { type: 'EDIT'; id: string; fields: Partial<Pick<QueueItem, 'title' | 'author'>> }
  | { type: 'REMOVE'; id: string };

let nextId = 1;

/** Strips only the final extension: "v2.final.wav" -> "v2.final". */
function titleFromFilename(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx > 0 ? filename.slice(0, idx) : filename;
}

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

/**
 * Builds ADD actions for a batch of dropped/chosen files. A file whose
 * extension isn't in `acceptedExtensions` is queued as `rejected` up front —
 * before any ticket request — with a row-visible reason (spec R9a: "Reject a
 * dropped file whose extension isn't in the chosen kind's extensions before
 * requesting a ticket, showing why in its row").
 */
export function addFiles(
  files: File[],
  kind: string,
  acceptedExtensions?: readonly string[],
): Extract<QueueAction, { type: 'ADD' }> {
  const items: QueueItem[] = files.map((file) => {
    const ext = extensionOf(file.name);
    const accepted =
      !acceptedExtensions || acceptedExtensions.some((e) => e.toLowerCase() === ext);

    return {
      id: `upload-${nextId++}-${Date.now().toString(36)}`,
      file,
      kind,
      title: titleFromFilename(file.name),
      author: '',
      status: accepted ? 'queued' : 'rejected',
      error: accepted
        ? undefined
        : `"${ext || file.name}" isn't accepted for ${kind}. Allowed: ${(acceptedExtensions ?? []).join(', ')}.`,
    };
  });

  return { type: 'ADD', items };
}

export function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'ADD':
      return { items: [...state.items, ...action.items] };

    case 'STATE':
      return updateItem(state, action.id, (item) => ({ ...item, status: action.state }));

    case 'DONE':
      return updateItem(state, action.id, (item) => ({
        ...item,
        status: 'done',
        assetId: action.assetId,
        assetStatus: action.assetStatus,
      }));

    case 'FAILED':
      return updateItem(state, action.id, (item) => ({
        ...item,
        status: 'failed',
        error: action.error,
      }));

    case 'RETRY':
      return updateItem(state, action.id, (item) => ({
        ...item,
        status: 'queued',
        error: undefined,
      }));

    case 'EDIT':
      return updateItem(state, action.id, (item) => ({ ...item, ...action.fields }));

    case 'REMOVE':
      return { items: state.items.filter((item) => item.id !== action.id) };

    default:
      return state;
  }
}

function updateItem(
  state: QueueState,
  id: string,
  updater: (item: QueueItem) => QueueItem,
): QueueState {
  const index = state.items.findIndex((item) => item.id === id);
  if (index === -1) return state;

  const items = [...state.items];
  items[index] = updater(items[index]);
  return { items };
}
