import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadFontVersion } from './font-version';

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const PUT_URL = 'https://acct.r2.cloudflarestorage.com/slimshot-audio/slimshot/fonts/v2.otf?X-Amz-Signature=sig';

/** Ticket, R2 PUT and finalize; records every call. */
function stubVersionFlow(
  finalize: () => Response = () => jsonResponse({ success: true, data: { assetId: 'f1', status: 'published' } }),
  storage: () => Response = () => new Response(null, { status: 200 }),
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
            assetId: 'f1',
            sessionId: 's-font',
            uploadUrl: PUT_URL,
            method: 'PUT',
            headers: { 'Content-Type': 'font/otf', 'If-None-Match': '*' },
            storageKey: 'slimshot/fonts/v2.otf',
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

const OTF = new File(['otf-bytes'], 'Lato-Regular.OTF', { type: '' });

describe('uploadFontVersion', () => {
  it('asks for a new original of this font, uploads it, then finalizes', async () => {
    const calls = stubVersionFlow();
    await uploadFontVersion('f1', OTF);

    expect(calls.map((c) => c.url)).toEqual([
      expect.stringContaining('/assets/upload-ticket'),
      PUT_URL,
      expect.stringContaining('/assets/finalize'),
    ]);
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({
      role: 'original',
      assetId: 'f1',
      filename: 'Lato-Regular.OTF',
      mimeType: 'font/otf',
      byteSize: OTF.size,
    });
    expect(calls[1].init?.body).toBe(OTF);
    expect(new Headers(calls[1].init?.headers).get('content-type')).toBe('font/otf');
    expect(JSON.parse(calls[2].init!.body as string)).toEqual({ sessionId: 's-font' });
  });

  it("rejects with the server's reason when the file is a different face", async () => {
    stubVersionFlow(() =>
      jsonResponse(
        { success: false, error: { code: 'VALIDATION_FAILED', message: 'This file is Lato Bold, not Lato Regular.', traceId: 't' } },
        422,
      ),
    );
    await expect(uploadFontVersion('f1', OTF)).rejects.toMatchObject({
      message: 'This file is Lato Bold, not Lato Regular.',
    });
  });

  it('never finalizes when storage refuses the file', async () => {
    const calls = stubVersionFlow(undefined, () => new Response('<Error><Code>AccessDenied</Code></Error>', { status: 403 }));
    await expect(uploadFontVersion('f1', OTF)).rejects.toThrow();
    expect(calls.some((c) => c.url.includes('finalize'))).toBe(false);
  });
});
