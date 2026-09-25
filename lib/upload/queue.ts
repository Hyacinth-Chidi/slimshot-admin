import { ApiError, apiFetch } from '@/lib/api/client';
import { withRefresh } from '@/lib/auth/session';

export type UploadState =
  | 'queued'
  | 'ticketing'
  | 'uploading'
  | 'finalizing'
  | 'done'
  | 'failed';

export interface UploadMeta {
  kind: string;
  title: string;
  author?: string;
}

interface Hooks {
  onState?: (state: UploadState) => void;
  onProgress?: (fraction: number) => void;
}

/**
 * The server's ticket response (IngestService.createTicket, returning
 * TicketResponse — ../slimshot_server/src/modules/ingest/ingest.service.ts:19-26).
 */
interface TicketResponse {
  assetId: string;
  sessionId: string;
  uploadUrl: string;
  storageKey: string;
  /** Signed multipart form fields (Cloudinary signed upload) — must all be
   * resent verbatim in the direct-upload POST or Cloudinary can't verify the
   * signature. */
  fields: Record<string, string>;
  expiresAt: string;
}

interface FinalizeResponse {
  assetId: string;
  status: string;
}

/**
 * Canonical MIME per extension, matching the server's accepted list exactly
 * (upload.audio.mimeTypes default — ../slimshot_server/src/core/settings/
 * setting-definitions.ts:15-20 — for the audio descriptor's extensions
 * .mp3/.wav/.aac/.ogg/.flac). The server compares the declared type with
 * `includes` (kind-registry.ts:57) and rejects before creating a draft, so
 * the browser's File.type cannot be sent as-is: it is "" for some types on
 * Windows, `audio/vnd.dlna.adts` for .aac there, and `audio/x-wav` /
 * `audio/x-flac` on Firefox. Declaring by extension is safe because
 * finalize re-validates the provider-detected type server-side
 * (ingest.service.ts:181-192).
 */
const CANONICAL_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
};

export function declaredMimeType(file: File): string {
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  return CANONICAL_MIME[ext] ?? file.type;
}

/**
 * Cloudinary reports a failed upload as JSON `{ error: { message } }`
 * (spec §6.3: a failed file keeps the server's message). Anything else — a
 * proxy's HTML page, an empty body — falls back to the status.
 */
async function directUploadError(res: Response): Promise<Error> {
  try {
    const body = (await res.json()) as { error?: { message?: unknown } } | null;
    const message = body?.error?.message;
    if (typeof message === 'string' && message.trim()) return new Error(message);
  } catch {
    // Not JSON: use the status below.
  }
  return new Error(`Upload failed (${res.status}).`);
}

/**
 * Each file runs its own ticket -> direct-upload -> finalize sequence so one
 * failure does not fail the batch. finalize is reached ONLY after the direct
 * upload succeeds: finalizing an upload that never landed would create an
 * asset row pointing at a file that does not exist.
 *
 * The direct upload is a signed multipart POST (Cloudinary), not a PUT: the
 * ticket carries `fields` (timestamp/signature/api_key/...) that must travel
 * as form fields alongside the file, or Cloudinary rejects the signature
 * (CloudinaryAdapter.createUploadTicket,
 * ../slimshot_server/src/core/storage/adapters/cloudinary.adapter.ts:69-110).
 *
 * `title`/`author` are sent on the ticket call, because CreateUploadTicketDto
 * declares them and FinalizeUploadDto declares only `sessionId`
 * (verified against ../slimshot_server/src/modules/ingest/dto/*.ts).
 */
export async function uploadFile(
  file: File,
  meta: UploadMeta,
  hooks: Hooks,
): Promise<{ assetId: string; status: string }> {
  const mimeType = declaredMimeType(file);
  // The multipart part carries the same canonical type as the ticket.
  const upload = file.type === mimeType ? file : new File([file], file.name, { type: mimeType });

  try {
    hooks.onState?.('ticketing');
    const ticket = await withRefresh(() =>
      apiFetch<TicketResponse>('/assets/upload-ticket', {
        method: 'POST',
        body: JSON.stringify({
          kind: meta.kind,
          filename: file.name,
          mimeType,
          byteSize: file.size,
          title: meta.title,
          ...(meta.author ? { author: meta.author } : {}),
        }),
      }),
    );

    hooks.onState?.('uploading');
    const form = new FormData();
    for (const [key, value] of Object.entries(ticket.fields)) {
      form.set(key, value);
    }
    form.set('file', upload);

    const put = await fetch(ticket.uploadUrl, { method: 'POST', body: form });
    if (!put.ok) throw await directUploadError(put);
    hooks.onProgress?.(1);

    hooks.onState?.('finalizing');
    const result = await withRefresh(() =>
      apiFetch<FinalizeResponse>('/assets/finalize', {
        method: 'POST',
        body: JSON.stringify({ sessionId: ticket.sessionId }),
      }),
    );

    hooks.onState?.('done');
    return result;
  } catch (err) {
    hooks.onState?.('failed');
    if (err instanceof ApiError) throw err;
    throw err instanceof Error ? err : new Error('Upload failed.');
  }
}
