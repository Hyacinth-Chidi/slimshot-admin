import { afterEach, describe, expect, it, vi } from 'vitest';
import { startItems } from './orchestrator';
import { addFiles, queueReducer, type QueueAction, type QueueState } from './reducer';

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function file(name: string) {
  return new File(['x'], name, { type: 'audio/mpeg' });
}

/** A tiny in-test store so dispatch behaves like the real reducer without
 * mounting React — startItems only needs a dispatch function and a way to
 * read the current item back out, exactly like the component will give it. */
function makeStore() {
  let state: QueueState = { items: [] };
  const dispatch = (action: QueueAction) => {
    state = queueReducer(state, action);
  };
  return { dispatch, getState: () => state };
}

describe('startItems', () => {
  it('runs each item independently: one 422 ticket refusal never stops or blocks another item finishing', async () => {
    const { dispatch, getState } = makeStore();
    dispatch(addFiles([file('a.mp3'), file('b.mp3')], 'audio'));
    const [a, b] = getState().items;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).includes('upload-ticket')) {
          const body = JSON.parse(init!.body as string) as { filename: string };
          if (body.filename === 'a.mp3') {
            return jsonResponse(
              { success: false, error: { code: 'UNPROCESSABLE', message: 'Unsupported extension', traceId: 't' } },
              422,
            );
          }
          return jsonResponse({
            success: true,
            data: {
              assetId: 'asset-b',
              sessionId: 'sess-b',
              uploadUrl: 'https://api.cloudinary.com/v1_1/demo/video/upload',
              storageKey: 'slimshot/audio/b',
              fields: {},
              expiresAt: new Date(Date.now() + 900_000).toISOString(),
            },
          });
        }
        if (String(url).includes('finalize')) {
          return jsonResponse({ success: true, data: { assetId: 'asset-b', status: 'ready' } });
        }
        return new Response(JSON.stringify({ public_id: 'x' }), { status: 200 });
      }),
    );

    let doneCount = 0;
    await startItems([a, b], dispatch, getState, () => {
      doneCount += 1;
    });

    const finalState = getState();
    const finalA = finalState.items.find((i) => i.id === a.id)!;
    const finalB = finalState.items.find((i) => i.id === b.id)!;

    expect(finalA.status).toBe('failed');
    expect(finalA.error).toBe('Unsupported extension');
    expect(finalB.status).toBe('done');
    expect(finalB.assetId).toBe('asset-b');

    // onDone fires once, for the item that actually finished — never for the
    // one that failed.
    expect(doneCount).toBe(1);
  });

  it('reads the CURRENT item from the store at start time, not the snapshot passed in', async () => {
    // Regression for R9f: a caller might hold a stale reference to an item
    // (e.g. from an earlier render) whose title/author were since edited in
    // the reducer. startItems must look the item back up by id before
    // building the ticket request, not trust the object it was handed.
    const { dispatch, getState } = makeStore();
    dispatch(addFiles([file('a.mp3')], 'audio'));
    const staleItem = getState().items[0];

    dispatch({ type: 'EDIT', id: staleItem.id, fields: { title: 'Edited title', author: 'Edited author' } });

    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        if (String(url).includes('upload-ticket')) {
          return jsonResponse({
            success: true,
            data: {
              assetId: 'a1',
              sessionId: 's1',
              uploadUrl: 'https://api.cloudinary.com/v1_1/demo/video/upload',
              storageKey: 'slimshot/audio/a',
              fields: {},
              expiresAt: new Date(Date.now() + 900_000).toISOString(),
            },
          });
        }
        if (String(url).includes('finalize')) {
          return jsonResponse({ success: true, data: { assetId: 'a1', status: 'ready' } });
        }
        return new Response(JSON.stringify({ public_id: 'x' }), { status: 200 });
      }),
    );

    // Passed the STALE item (pre-edit title/author) — startItems must still
    // send the edited values because it re-reads from the store.
    await startItems([staleItem], dispatch, getState, () => {});

    const ticketCall = calls.find((c) => c.url.includes('upload-ticket'))!;
    const ticketBody = JSON.parse(ticketCall.init!.body as string);
    expect(ticketBody.title).toBe('Edited title');
    expect(ticketBody.author).toBe('Edited author');
  });

  it('skips an item that is no longer queued by the time it would start (e.g. removed)', async () => {
    const { dispatch, getState } = makeStore();
    dispatch(addFiles([file('a.mp3')], 'audio'));
    const item = getState().items[0];
    dispatch({ type: 'REMOVE', id: item.id });

    const fetchMock = vi.fn(async () => jsonResponse({ success: true, data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    let doneCount = 0;
    await startItems([item], dispatch, getState, () => {
      doneCount += 1;
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(doneCount).toBe(0);
  });
});
