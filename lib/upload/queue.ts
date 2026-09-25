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
  try {
    hooks.onState?.('ticketing');
    const ticket = await withRefresh(() =>
      apiFetch<TicketResponse>('/assets/upload-ticket', {
        method: 'POST',
        body: JSON.stringify({
          kind: meta.kind,
          filename: file.name,
          mimeType: file.type,
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
    form.set('file', file);

    const put = await fetch(ticket.uploadUrl, { method: 'POST', body: form });
    if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
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
