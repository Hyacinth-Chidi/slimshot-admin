import { afterEach, describe, expect, it, vi } from 'vitest';
import { declaredImageMime, uploadCover } from './cover';

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const PUT_URL = 'https://acct.r2.cloudflarestorage.com/slimshot-audio/slimshot/covers/c.png?X-Amz-Signature=sig';

/** Ticket, R2 PUT and finalize; records every call. `storage` answers the PUT. */
function stubCoverFlow(
  storage: () => Response | Promise<Response> = () => new Response(null, { status: 200 }),
  finalize: () => Response = () => jsonResponse({ success: true, data: { assetId: 'a1', status: 'published' } }),
) {
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
            sessionId: 's-cover',
            uploadUrl: PUT_URL,
            method: 'PUT',
            headers: { 'Content-Type': 'image/png', 'If-None-Match': '*' },
            storageKey: 'slimshot/covers/c.png',
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          },
        });
      }
      if (String(url).includes('finalize')) return finalize();
      return storage();
    }),
  );
  return calls;
}

const COVER = new File(['png-bytes'], 'Cover.PNG', { type: '' });

describe('uploadCover', () => {
  it('runs ticket, R2 PUT and finalize in order for the given sound', async () => {
    const calls = stubCoverFlow();
    await uploadCover('a1', COVER);

    expect(calls.map((c) => c.url)).toEqual([
      expect.stringContaining('/assets/upload-ticket'),
      PUT_URL,
      expect.stringContaining('/assets/finalize'),
    ]);
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({
      role: 'thumbnail',
      assetId: 'a1',
      filename: 'Cover.PNG',
      mimeType: 'image/png',
      byteSize: COVER.size,
    });
    const put = new Headers(calls[1].init?.headers);
    expect(calls[1].init?.method).toBe('PUT');
    expect(calls[1].init?.body).toBe(COVER);
    expect(put.get('content-type')).toBe('image/png');
    expect(put.get('if-none-match')).toBe('*');
    expect(put.has('authorization')).toBe(false);
    expect(JSON.parse(calls[2].init!.body as string)).toEqual({ sessionId: 's-cover' });
  });

  it("rejects with the server's reason when finalize refuses the image", async () => {
    stubCoverFlow(undefined, () =>
      jsonResponse(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'The file is not a supported image (JPEG, PNG or WebP).', traceId: 't' },
        },
        400,
      ),
    );
    await expect(uploadCover('a1', COVER)).rejects.toMatchObject({
      message: 'The file is not a supported image (JPEG, PNG or WebP).',
    });
  });

  it('explains a blocked storage upload and never finalizes', async () => {
    const calls = stubCoverFlow(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(uploadCover('a1', COVER)).rejects.toMatchObject({
      message: "Couldn't reach file storage. Check your connection, and that the bucket's CORS policy allows this site.",
    });
    expect(calls.some((c) => c.url.includes('finalize'))).toBe(false);
  });
});

describe('declaredImageMime', () => {
  it.each([
    ['a.jpg', '', 'image/jpeg'],
    ['a.JPEG', '', 'image/jpeg'],
    ['a.png', '', 'image/png'],
    ['a.webp', 'application/octet-stream', 'image/webp'],
    ['a.gif', 'image/gif', 'image/gif'],
  ])('%s (browser says %j) is declared as %s', (name, type, expected) => {
    expect(declaredImageMime(new File(['x'], name, { type }))).toBe(expected);
  });
});
