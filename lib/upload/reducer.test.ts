import { describe, expect, it } from 'vitest';
import { addFiles, queueReducer, type QueueState } from './reducer';

const EMPTY: QueueState = { items: [] };

function file(name: string) {
  return new File(['x'], name, { type: 'audio/mpeg' });
}

describe('queueReducer', () => {
  it('adds a file as a queued item with title defaulted from the filename', () => {
    const state = queueReducer(EMPTY, addFiles([file('My Loop.mp3')], 'audio'));
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({
      status: 'queued',
      title: 'My Loop',
      kind: 'audio',
      author: '',
      categoryId: undefined,
    });
    expect(state.items[0].id).toBeTruthy();
  });

  it('strips only the final extension when defaulting the title', () => {
    const state = queueReducer(EMPTY, addFiles([file('v2.final.wav')], 'audio'));
    expect(state.items[0].title).toBe('v2.final');
  });

  it('assigns each added file a distinct stable id', () => {
    const state = queueReducer(EMPTY, addFiles([file('a.mp3'), file('b.mp3')], 'audio'));
    const [a, b] = state.items;
    expect(a.id).not.toBe(b.id);
  });

  it('rejects a file whose extension the kind does not accept, without touching fetch', () => {
    const state = queueReducer(
      EMPTY,
      addFiles([file('cover.png')], 'audio', ['.mp3', '.wav', '.aac', '.ogg', '.flac']),
    );
    expect(state.items[0].status).toBe('rejected');
    expect(state.items[0].error).toMatch(/\.png/i);
    expect(state.items[0].error).toMatch(/audio/i);
  });

  it('accepts a file whose extension matches case-insensitively', () => {
    const state = queueReducer(EMPTY, addFiles([file('Loop.MP3')], 'audio', ['.mp3']));
    expect(state.items[0].status).toBe('queued');
  });

  it('moves a queued item through the upload state machine on STATE', () => {
    let state = queueReducer(EMPTY, addFiles([file('a.mp3')], 'audio'));
    const id = state.items[0].id;
    state = queueReducer(state, { type: 'STATE', id, state: 'ticketing' });
    expect(state.items[0].status).toBe('ticketing');
    state = queueReducer(state, { type: 'STATE', id, state: 'uploading' });
    expect(state.items[0].status).toBe('uploading');
    state = queueReducer(state, { type: 'STATE', id, state: 'done' });
    expect(state.items[0].status).toBe('done');
  });

  it('records the resulting asset status on DONE', () => {
    let state = queueReducer(EMPTY, addFiles([file('a.mp3')], 'audio'));
    const id = state.items[0].id;
    state = queueReducer(state, { type: 'DONE', id, assetId: 'a1', assetStatus: 'ready' });
    expect(state.items[0]).toMatchObject({ status: 'done', assetId: 'a1', assetStatus: 'ready' });
  });

  it('keeps the server error message on FAILED and leaves other items untouched', () => {
    let state = queueReducer(EMPTY, addFiles([file('a.mp3'), file('b.mp3')], 'audio'));
    const [a, b] = state.items;
    state = queueReducer(state, { type: 'FAILED', id: a.id, error: 'Unsupported extension' });

    expect(state.items[0]).toMatchObject({ status: 'failed', error: 'Unsupported extension' });
    // A failure in one file's sequence must never mutate another's state.
    expect(state.items[1]).toMatchObject({ status: 'queued' });
    expect(state.items[1].id).toBe(b.id);
  });

  it('resets a failed item back to queued on RETRY, clearing its error', () => {
    let state = queueReducer(EMPTY, addFiles([file('a.mp3')], 'audio'));
    const id = state.items[0].id;
    state = queueReducer(state, { type: 'FAILED', id, error: 'Upload failed (500).' });
    state = queueReducer(state, { type: 'RETRY', id });
    expect(state.items[0]).toMatchObject({ status: 'queued', error: undefined });
  });

  it('updates editable fields (title, author, categoryId) without touching status', () => {
    let state = queueReducer(EMPTY, addFiles([file('a.mp3')], 'audio'));
    const id = state.items[0].id;
    state = queueReducer(state, { type: 'STATE', id, state: 'uploading' });
    state = queueReducer(state, { type: 'EDIT', id, fields: { title: 'New title', author: 'DJ X', categoryId: 'c9' } });
    expect(state.items[0]).toMatchObject({
      title: 'New title',
      author: 'DJ X',
      categoryId: 'c9',
      status: 'uploading',
    });
  });

  it('removes an item from the queue', () => {
    let state = queueReducer(EMPTY, addFiles([file('a.mp3'), file('b.mp3')], 'audio'));
    const [a, b] = state.items;
    state = queueReducer(state, { type: 'REMOVE', id: a.id });
    expect(state.items).toHaveLength(1);
    expect(state.items[0].id).toBe(b.id);
  });

  it('is a no-op for an unknown id, never throwing', () => {
    const state = queueReducer(EMPTY, addFiles([file('a.mp3')], 'audio'));
    const next = queueReducer(state, { type: 'STATE', id: 'nope', state: 'done' });
    expect(next).toEqual(state);
  });
});
