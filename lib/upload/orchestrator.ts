import type { Dispatch } from 'react';
import { uploadFile } from './queue';
import type { QueueAction, QueueItem, QueueState } from './reducer';

/**
 * Runs one item's full ticket -> direct-upload -> finalize sequence and
 * dispatches its state transitions.
 *
 * `getState` is read at call time (not just once, up front) so the request
 * always carries the CURRENT title/author from the reducer — including edits
 * made after the item was added, or after a previous failed attempt, right
 * up until the moment the ticket request actually fires. `startItems` below
 * is the only caller that matters for this: passing a stale `item` argument
 * must not leak stale field values into the request (R9f).
 *
 * If the item has been removed (or otherwise is no longer in the queue) by
 * the time this runs, it is skipped entirely — no network call, no dispatch,
 * `onDone` not called.
 */
async function runItem(
  id: string,
  dispatch: Dispatch<QueueAction>,
  getState: () => QueueState,
  onDone: () => void,
) {
  const current = getState().items.find((i) => i.id === id);
  if (!current) return;

  try {
    const result = await uploadFile(
      current.file,
      { kind: current.kind, title: current.title, author: current.author || undefined },
      { onState: (state) => dispatch({ type: 'STATE', id, state }) },
    );
    dispatch({ type: 'DONE', id, assetId: result.assetId, assetStatus: result.status });
    onDone();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed.';
    dispatch({ type: 'FAILED', id, error: message });
  }
}

/**
 * Starts every given item's upload sequence independently and in parallel —
 * one item's ticket/upload/finalize failing never blocks, delays or aborts
 * any other item's sequence (spec §6.3). `items` only supplies which ids to
 * start; each sequence reads its own item fresh from `getState()` right
 * before it builds the ticket request, so edits made between "Upload" being
 * clicked and the request firing (or made to a DIFFERENT item while this one
 * is in flight) are respected rather than a stale snapshot.
 *
 * Resolves once every started sequence has settled (succeeded or failed) —
 * callers that don't need to wait can call this without awaiting it.
 */
export async function startItems(
  items: QueueItem[],
  dispatch: Dispatch<QueueAction>,
  getState: () => QueueState,
  onDone: () => void,
): Promise<void> {
  await Promise.all(items.map((item) => runItem(item.id, dispatch, getState, onDone)));
}
