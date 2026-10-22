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
              uploadUrl: 'https://acct.r2.cloudflarestorage.com/slimshot-audio/slimshot/audio/abc.mp3?X-Amz-Signature=sig',
              method: 'PUT',
              headers: { 'Content-Type': 'audio/mpeg', 'If-None-Match': '*' },
              storageKey: 'slimshot/audio/abc.mp3',
              expiresAt: new Date(Date.now() + 900_000).toISOString(),
            },
          });
        }
        if (String(url).includes('finalize')) {
          return jsonResponse({ success: true, data: { assetId: 'a1', status: 'ready' } });
        }
        // The direct upload itself: R2's presigned URL, not our API. R2
        // answers 200 with an empty body.
        return new Response(null, { status: 200 });
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

    // The direct upload is the raw file, PUT to the presigned URL with exactly
    // the headers the ticket lists: R2 signed the type and the length, so any
    // other Content-Type is refused.
    expect(calls[1].url).toBe('https://acct.r2.cloudflarestorage.com/slimshot-audio/slimshot/audio/abc.mp3?X-Amz-Signature=sig');
    expect(calls[1].init?.method).toBe('PUT');
    expect(calls[1].init?.body).toBe(FILE);
    expect(new Headers(calls[1].init?.headers).get('content-type')).toBe('audio/mpeg');
    // Create-only: every signed header the ticket lists goes along as given.
    expect(new Headers(calls[1].init?.headers).get('if-none-match')).toBe('*');
    // R2 is a third party, not our API: this PUT must carry no Authorization
    // header and no cookies/credentials. The URL's signature is the only auth
    // R2 needs, and leaking our bearer token to another host would be a real
    // credential leak.
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
              uploadUrl: 'https://acct.r2.cloudflarestorage.com/slimshot-audio/slimshot/audio/abc.mp3?X-Amz-Signature=sig',
              method: 'PUT',
              headers: { 'Content-Type': 'audio/mpeg' },
              storageKey: 'slimshot/audio/abc.mp3',
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
              uploadUrl: 'https://acct.r2.cloudflarestorage.com/slimshot-audio/slimshot/audio/abc.mp3?X-Amz-Signature=sig',
              method: 'PUT',
              headers: { 'Content-Type': 'audio/mpeg' },
              storageKey: 'slimshot/audio/abc.mp3',
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
        return new Response(null, { status: 200 });
      }),
    );

    const states: string[] = [];
    await expect(
      uploadFile(FILE, META, { onState: (s) => states.push(s) }),
    ).rejects.toMatchObject({ message: 'This upload session has expired.' });
    expect(states).toEqual(['ticketing', 'uploading', 'finalizing', 'failed']);
  });
});

/**
 * Stubs fetch with a ticket, an R2 response, and a finalize; records every call.
 * Like the server, the ticket signs whatever type the ticket request declared.
 */
function stubUploadFlow(storage: () => Response | Promise<Response> = () => new Response(null, { status: 200 })) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('upload-ticket')) {
        const declared = (JSON.parse(init!.body as string) as { mimeType: string }).mimeType;
        return jsonResponse({
          success: true,
          data: {
            assetId: 'a1',
            sessionId: 's1',
            uploadUrl: 'https://acct.r2.cloudflarestorage.com/slimshot-audio/slimshot/audio/abc.mp3?X-Amz-Signature=sig',
            method: 'PUT',
            headers: { 'Content-Type': declared },
            storageKey: 'slimshot/audio/abc.mp3',
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          },
        });
      }
      if (String(url).includes('finalize')) {
        return jsonResponse({ success: true, data: { assetId: 'a1', status: 'ready' } });
      }
      return storage();
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
    ['Lato-Regular.ttf', '', 'font/ttf'],
    ['Lato-Regular.TTF', 'application/x-font-ttf', 'font/ttf'],
    ['SourceSerif4.otf', 'application/vnd.ms-opentype', 'font/otf'],
  ])('%s with File.type %j declares %s on the ticket and the upload', async (name, type, canonical) => {
    const calls = stubUploadFlow();
    const file = new File(['x'], name, { type });

    await uploadFile(file, META, {});

    expect(JSON.parse(calls[0].init!.body as string).mimeType).toBe(canonical);
    // The PUT carries the signed type, whatever the browser thinks the file is.
    expect(new Headers(calls[1].init?.headers).get('content-type')).toBe(canonical);
    expect(calls[1].init?.body).toBe(file);
  });

  it("falls back to the browser's type for an extension it has no mapping for", async () => {
    const calls = stubUploadFlow();
    await uploadFile(new File(['x'], 'clip.m4a', { type: 'audio/mp4' }), META, {});
    expect(JSON.parse(calls[0].init!.body as string).mimeType).toBe('audio/mp4');
  });
});

describe('uploadFile storage failure message (I4)', () => {
  // Spec §6.3: a failed file keeps the storage's own reason. R2 answers S3-style XML.
  it("keeps R2's own message and code from its XML error", async () => {
    stubUploadFlow(
      () =>
        new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Error><Code>SignatureDoesNotMatch</Code>' +
            '<Message>The request signature we calculated does not match the signature you provided. </Message></Error>',
          { status: 403, headers: { 'content-type': 'application/xml' } },
        ),
    );
    await expect(uploadFile(FILE, META, {})).rejects.toMatchObject({
      message:
        'The request signature we calculated does not match the signature you provided. (SignatureDoesNotMatch)',
    });
  });

  it('names the code when R2 gives no message', async () => {
    stubUploadFlow(() => new Response('<Error><Code>AccessDenied</Code></Error>', { status: 403 }));
    await expect(uploadFile(FILE, META, {})).rejects.toMatchObject({
      message: 'Upload failed (403): AccessDenied.',
    });
  });

  it('falls back to the status message when the failed response is not XML', async () => {
    stubUploadFlow(() => new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(uploadFile(FILE, META, {})).rejects.toMatchObject({
      message: 'Upload failed (502).',
    });
  });

  it('explains a blocked or unreachable storage upload, and never finalizes', async () => {
    // A missing CORS policy on the bucket surfaces in the browser as a bare
    // "Failed to fetch": say what to check instead.
    const calls = stubUploadFlow(() => {
      throw new TypeError('Failed to fetch');
    });
    const states: string[] = [];
    await expect(uploadFile(FILE, META, { onState: (s) => states.push(s) })).rejects.toMatchObject({
      message: "Couldn't reach file storage. Check your connection, and that the bucket's CORS policy allows this site.",
    });
    expect(calls.some((c) => c.url.includes('finalize'))).toBe(false);
    expect(states).toEqual(['ticketing', 'uploading', 'failed']);
  });
});

describe('uploadFile category', () => {
  it('files the new sound under the chosen category', async () => {
    const calls = stubUploadFlow();
    await uploadFile(FILE, { ...META, categoryId: 'c1' }, {});
    expect(JSON.parse(calls[0].init!.body as string).categoryId).toBe('c1');
  });

  it('sends no categoryId key when none is chosen', async () => {
    const calls = stubUploadFlow();
    await uploadFile(FILE, META, {});
    expect(JSON.parse(calls[0].init!.body as string)).not.toHaveProperty('categoryId');
  });
});
