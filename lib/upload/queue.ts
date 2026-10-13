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
  /** Presigned Cloudflare R2 URL: the signature in it is the only auth needed. */
  uploadUrl: string;
  method: 'PUT';
  /** Must be sent exactly: R2 signed them (Content-Type, If-None-Match) and the length. */
  headers: Record<string, string>;
  storageKey: string;
  expiresAt: string;
}

interface FinalizeResponse {
  assetId: string;
  status: string;
}

/**
 * Canonical MIME per extension, matching the server's accepted list exactly
 * (the default of its UPLOAD_AUDIO_MIME_TYPES env variable, for the audio
 * descriptor's extensions .mp3/.wav/.aac/.ogg/.flac). The server compares the declared type with
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

/** The text of one `<Tag>…</Tag>` in R2's XML error, if present. */
function xmlTag(xml: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  const text = match?.[1].trim();
  return text ? text : undefined;
}

/**
 * R2 reports a failed upload S3-style, as XML `<Error><Code/><Message/></Error>`
 * (spec §6.3: a failed file keeps the storage's reason). Anything else, such as
 * a proxy's HTML page or an empty body, falls back to the status.
 */
async function directUploadError(res: Response): Promise<Error> {
  const body = await res.text().catch(() => '');
  const code = xmlTag(body, 'Code');
  const message = xmlTag(body, 'Message');
  if (message) return new Error(code ? `${message} (${code})` : message);
  if (code) return new Error(`Upload failed (${res.status}): ${code}.`);
  return new Error(`Upload failed (${res.status}).`);
}

const UNREACHABLE_STORAGE =
  "Couldn't reach file storage. Check your connection, and that the bucket's CORS policy allows this site.";

/**
 * Each file runs its own ticket -> direct-upload -> finalize sequence so one
 * failure does not fail the batch. finalize is reached ONLY after the direct
 * upload succeeds: finalizing an upload that never landed would create an
 * asset row pointing at a file that does not exist.
 *
 * The direct upload is the raw file PUT to a presigned Cloudflare R2 URL, with
 * exactly the ticket's headers: R2 signed the Content-Type and the length, so
 * any other type or size is refused (R2Adapter.createUploadTicket,
 * ../slimshot_server/src/core/storage/adapters/r2.adapter.ts).
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
    // A different host: no Authorization header, no cookies. The browser sets
    // Content-Length from the file, which R2 checks against the signed size.
    // A rejected fetch here is almost always the bucket's CORS policy.
    const put = await fetch(ticket.uploadUrl, {
      method: ticket.method,
      headers: ticket.headers,
      body: file,
    }).catch(() => {
      throw new Error(UNREACHABLE_STORAGE);
    });
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
