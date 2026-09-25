import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadFile } from './queue';

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const FILE = new File(['x'], 'loop.mp3', { type: 'audio/mpeg' });
const META = { kind: 'audio', title: 'Loop', author: 'DJ Test' };

describe('uploadFile', () => {
  it('runs ticket, upload, finalize in order and reports ready', async () => {
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
              storageKey: 'slimshot/audio/abc',
              fields: { timestamp: '1700000000', signature: 'sig', api_key: 'key' },
              expiresAt: new Date(Date.now() + 900_000).toISOString(),
            },
          });
        }
        if (String(url).includes('finalize')) {
          return jsonResponse({ success: true, data: { assetId: 'a1', status: 'ready' } });
        }
        // The direct upload itself: Cloudinary's signed-upload endpoint, not
        // our API — returns whatever shape the provider returns, unread here.
        return new Response(JSON.stringify({ public_id: 'slimshot/audio/abc' }), { status: 200 });
      }),
    );

    const states: string[] = [];
    const result = await uploadFile(FILE, META, { onState: (s) => states.push(s) });

    expect(result.status).toBe('ready');
    expect(result.assetId).toBe('a1');
    expect(calls[0].url).toContain('upload-ticket');
    // Ticket call carries kind/filename/mimeType/byteSize/title/author — NOT
    // contentType (the DTO field is `mimeType`) and NOT categoryId (the DTO
    // has no such field).
    const ticketBody = JSON.parse(calls[0].init!.body as string);
    expect(ticketBody).toEqual({
      kind: 'audio',
      filename: 'loop.mp3',
      mimeType: 'audio/mpeg',
      byteSize: FILE.size,
      title: 'Loop',
      author: 'DJ Test',
    });

    // The direct upload is a multipart POST to the signed uploadUrl, carrying
    // every signed field plus the file — not a PUT with a JSON/binary body.
    expect(calls[1].url).toBe('https://api.cloudinary.com/v1_1/demo/video/upload');
    expect(calls[1].init?.method).toBe('POST');
    const form = calls[1].init?.body as FormData;
    expect(form.get('timestamp')).toBe('1700000000');
    expect(form.get('signature')).toBe('sig');
    expect(form.get('api_key')).toBe('key');
    expect(form.get('file')).toBe(FILE);
    // Cloudinary is a third party, not our API: this POST must carry no
    // Authorization header and no cookies/credentials — the signed `fields`
    // are the only auth Cloudinary needs, and leaking our bearer token to a
    // third-party host would be a real credential leak.
    expect(new Headers(calls[1].init?.headers).has('authorization')).toBe(false);
    expect(calls[1].init?.credentials).not.toBe('include');

    expect(calls[2].url).toContain('finalize');
    const finalizeBody = JSON.parse(calls[2].init!.body as string);
    // finalize's DTO declares only sessionId — title/author/categoryId are
    // sent on the ticket call (or not at all), never here.
    expect(finalizeBody).toEqual({ sessionId: 's1' });

    expect(states).toEqual(['ticketing', 'uploading', 'finalizing', 'done']);
  });

  it('marks the file failed with the server message when the ticket is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { success: false, error: { code: 'UNPROCESSABLE', message: 'Unsupported extension', traceId: 't' } },
          422,
        ),
      ),
    );

    const states: string[] = [];
    await expect(
      uploadFile(FILE, META, { onState: (s) => states.push(s) }),
    ).rejects.toMatchObject({ message: 'Unsupported extension' });

    expect(states).toContain('failed');
  });

  it('does not call finalize when the storage upload fails', async () => {
    // Finalizing an upload that never landed creates an asset row pointing at
    // a file that does not exist.
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(String(url));
        if (String(url).includes('upload-ticket')) {
          return jsonResponse({
            success: true,
            data: {
              assetId: 'a1',
              sessionId: 's1',
              uploadUrl: 'https://api.cloudinary.com/v1_1/demo/video/upload',
              storageKey: 'slimshot/audio/abc',
              fields: {},
              expiresAt: new Date(Date.now() + 900_000).toISOString(),
            },
          });
        }
        return new Response(null, { status: 500 });
      }),
    );

    await expect(uploadFile(FILE, META, {})).rejects.toBeTruthy();
    expect(calls.some((c) => c.includes('finalize'))).toBe(false);
  });

  it('does not call the storage upload when the ticket request throws a network error', async () => {
    // A rejected fetch (offline, DNS failure) is a different failure mode
    // than a 4xx/5xx response — uploadFile must surface it as `failed` too,
    // not hang or throw an unhandled rejection past the caller.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const states: string[] = [];
    await expect(
      uploadFile(FILE, META, { onState: (s) => states.push(s) }),
    ).rejects.toBeTruthy();
    expect(states).toEqual(['ticketing', 'failed']);
  });

  it('reports the finalize error message when finalize itself is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('upload-ticket')) {
          return jsonResponse({
            success: true,
            data: {
              assetId: 'a1',
              sessionId: 's1',
              uploadUrl: 'https://api.cloudinary.com/v1_1/demo/video/upload',
              storageKey: 'slimshot/audio/abc',
              fields: {},
              expiresAt: new Date(Date.now() + 900_000).toISOString(),
            },
          });
        }
        if (String(url).includes('finalize')) {
          return jsonResponse(
            {
              success: false,
              error: { code: 'BAD_REQUEST', message: 'This upload session has expired.', traceId: 't' },
            },
            400,
          );
        }
        return new Response(JSON.stringify({ public_id: 'x' }), { status: 200 });
      }),
    );

    const states: string[] = [];
    await expect(
      uploadFile(FILE, META, { onState: (s) => states.push(s) }),
    ).rejects.toMatchObject({ message: 'This upload session has expired.' });
    expect(states).toEqual(['ticketing', 'uploading', 'finalizing', 'failed']);
  });
});

/** Stubs fetch with a ticket, a Cloudinary response, and a finalize; records every call. */
function stubUploadFlow(cloudinary: () => Response = () => new Response('{}', { status: 200 })) {
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
            storageKey: 'slimshot/audio/abc',
            fields: {},
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          },
        });
      }
      if (String(url).includes('finalize')) {
        return jsonResponse({ success: true, data: { assetId: 'a1', status: 'ready' } });
      }
      return cloudinary();
    }),
  );
  return calls;
}

describe('uploadFile declared MIME type (I3)', () => {
  // The server matches the declared mimeType exactly against the kind's
  // accepted list (upload.audio.mimeTypes: audio/mpeg, audio/wav, audio/aac,
  // audio/ogg, audio/flac) and rejects before creating a draft, so a raw
  // File.type — "" on Windows for some types, audio/vnd.dlna.adts for .aac,
  // audio/x-wav / audio/x-flac on Firefox — fails every retry identically.
  it.each([
    ['loop.mp3', '', 'audio/mpeg'],
    ['LOOP.MP3', '', 'audio/mpeg'],
    ['loop.aac', 'audio/vnd.dlna.adts', 'audio/aac'],
    ['loop.wav', 'audio/x-wav', 'audio/wav'],
    ['loop.flac', 'audio/x-flac', 'audio/flac'],
    ['loop.ogg', 'application/ogg', 'audio/ogg'],
  ])('%s with File.type %j declares %s on the ticket and the upload', async (name, type, canonical) => {
    const calls = stubUploadFlow();
    const file = new File(['x'], name, { type });

    await uploadFile(file, META, {});

    expect(JSON.parse(calls[0].init!.body as string).mimeType).toBe(canonical);
    const sent = (calls[1].init?.body as FormData).get('file') as File;
    expect(sent.type).toBe(canonical);
    expect(sent.name).toBe(name);
    expect(sent.size).toBe(file.size);
  });

  it("falls back to the browser's type for an extension it has no mapping for", async () => {
    const calls = stubUploadFlow();
    await uploadFile(new File(['x'], 'clip.m4a', { type: 'audio/mp4' }), META, {});
    expect(JSON.parse(calls[0].init!.body as string).mimeType).toBe('audio/mp4');
  });
});

describe('uploadFile Cloudinary failure message (I4)', () => {
  // Spec §6.3: a failed file keeps the server's error message.
  it("keeps Cloudinary's own error message from its JSON body", async () => {
    stubUploadFlow(
      () =>
        new Response(JSON.stringify({ error: { message: 'Invalid Signature 1f2e.' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
    );
    await expect(uploadFile(FILE, META, {})).rejects.toMatchObject({
      message: 'Invalid Signature 1f2e.',
    });
  });

  it('falls back to the status message when the failed response is not JSON', async () => {
    stubUploadFlow(() => new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(uploadFile(FILE, META, {})).rejects.toMatchObject({
      message: 'Upload failed (502).',
    });
  });

  it('falls back to the status message when the JSON has no error message', async () => {
    stubUploadFlow(() => new Response(JSON.stringify({ oops: true }), { status: 400 }));
    await expect(uploadFile(FILE, META, {})).rejects.toMatchObject({
      message: 'Upload failed (400).',
    });
  });
});
