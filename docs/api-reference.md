# SlimShot Admin API — verified reference

**Every shape below was captured from the running server on 2026-09-23**, not read from
source or inferred. Where this file and the implementation plan disagree, **this file
wins** — the plan was written before the API could be exercised and got four things wrong
(all corrected here, and noted at the bottom).

Base URL: `http://localhost:2700/api/admin/v1` (the server moved from 3000 to 2700 on 2026-09-25)
Set `NEXT_PUBLIC_API_BASE` to exactly that.

## Running the API

From `../slimshot_server` (or its worktree at `.worktrees/admin-api`):

```bash
npm run start:dev
```

It binds **port 2700** (`PORT` in its `.env`). Run the dashboard with `next dev -p 3001`
and set the server's `ADMIN_BASE_URL=http://localhost:3001` so CORS allows it.

`.env` there already holds `DATABASE_URL` (Neon dev database), `REDIS_URL`, and the owner
bootstrap credentials. Redis connects on boot; if you see `ECONNREFUSED` from ioredis, the
Redis URL has expired or been rotated.

## Credentials

```
email:    owner@slimshot.dev
password: DevOwner!2026-dashboard
```

Role is `owner`.

## Envelopes

Success, most endpoints:

```json
{ "success": true, "data": ... }
```

Success, **cursor-paginated** endpoints — note `meta` is a SIBLING of `data`, not nested:

```json
{ "success": true, "data": [...], "meta": { "nextCursor": null } }
```

Failure, every endpoint:

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "...", "traceId": "..." } }
```

`details` appears on a class-validator 422 as a flat `string[]` of messages, each starting with the property it is about — e.g. `["name must be shorter than or equal to 80 characters"]` (verified against `slimshot_server/src/core/errors/http-exception.filter.ts:75-80`). A plain `UnprocessableEntityException` sends no `details`. A Prisma unique-violation 409 sends the target columns. The dashboard parses it in one place: `lib/api/field-errors.ts`.

## Endpoints, with real responses

### `POST /auth/login` → 201

```json
{ "success": true, "data": {
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "sOPIH9Zv2URMAHi89YW3...",
  "expiresIn": 900
}}
```

The access token's payload carries `sub`, `email`, `role`, `iat`, `exp`.

### `GET /auth/me` → 200

```json
{ "success": true, "data": {
  "id": "cmue7d44p0000dsulkoy9vmk6",
  "email": "owner@slimshot.dev",
  "name": "Owner",
  "role": "owner"
}}
```

Also: `POST /auth/refresh` (body `{ refreshToken }`), `POST /auth/logout`.

### `GET /stats/summary` → 200

**The route is `/stats/summary`. The plan's `StatsSummary` type was wrong** — there is no
`publishedCount` and no `processingCount`. Real shape on an empty database:

```json
{ "success": true, "data": {
  "totalAssets": 0,
  "byStatus": {},
  "byKind": {},
  "totalBytes": 0,
  "failedCount": 0
}}
```

`byStatus` and `byKind` are keyed maps, populated only with statuses/kinds that have rows.
**Published and processing counts must be read out of `byStatus`**, defaulting to 0:

```ts
const published = summary.byStatus.published ?? 0;
const processing = summary.byStatus.processing ?? 0;
```

### `GET /stats/uploads-over-time?days=30` → 200

**The route is `uploads-over-time`, NOT `uploads`** — the plan had it wrong and `/stats/uploads`
returns a 404.

```json
{ "success": true, "data": [] }
```

Returns `{ date, count }` objects for **only the days that have data**. Zero-fill client
side, or a 3-point series spreads across a month and implies uploads on days that had none.

### `GET /assets?limit=2` → 200

**Cursor-paginated, so `meta` sits beside `data`** — `apiFetch` would discard it:

```json
{ "success": true, "data": [], "meta": { "nextCursor": null } }
```

Other asset routes: `GET /assets/:id`, `POST /assets/upload-ticket`, `POST /assets/finalize`,
`PATCH /assets/:id`, `POST /assets/:id/publish`, `POST /assets/:id/unpublish`,
`DELETE /assets/:id`.

### `GET /audit-logs?limit=2` → 200

Cursor-paginated, same envelope shape as assets:

```json
{ "success": true, "data": [{
  "id": "cmue9cqdw0008w4ulrorxeniz",
  "actorId": "cmue7d44p0000dsulkoy9vmk6",
  "actorType": "admin",
  "action": "auth.login.succeeded",
  "entityType": "AdminUser",
  "entityId": "cmue7d44p0000dsulkoy9vmk6",
  "before": null,
  "after": null,
  "ip": "::1",
  "userAgent": "curl/8.12.1",
  "createdAt": "2026-09-23T15:28:37.268Z"
}], "meta": { "nextCursor": null } }
```

Note `before`/`after`/`userAgent` — the plan's `AuditEntry` omitted all three.

Read-only. There is no delete route at any permission level.

### `GET /categories?kind=audio` → 200

```json
{ "success": true, "data": [] }
```

An empty or invalid `kind` is a **422**, not a 500 (fixed before merge).

Also: `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id`,
`POST /categories/reorder`.

`DELETE` returns **409** with the blocking count in `message` when assets reference the
category. Surface that message verbatim — the number is the actionable part.

### `GET /kinds` → 200

```json
{ "success": true, "data": [{
  "kind": "audio",
  "label": "Audio",
  "extensions": [".mp3", ".wav", ".aac", ".ogg", ".flac"],
  "fileRoles": [
    { "role": "original",  "required": true,  "multiple": false },
    { "role": "preview",   "required": false, "multiple": false },
    { "role": "waveform",  "required": false, "multiple": false },
    { "role": "thumbnail", "required": false, "multiple": false }
  ]
}]}
```

Drives the upload form per kind. **Only `audio` is registered today** — build the UI from
this array rather than hardcoding kinds, so fonts and templates appear when registered.

### `GET /jobs/health` → 200

```json
{ "success": true, "data": { "waiting": 0, "active": 0, "failed": 0, "delayed": 0 } }
```

The only jobs route that exists. `GET /jobs/failed` and `POST /jobs/:id/retry` are **not
implemented** — do not call them.

### Providers (owner only, permission `providers.manage`)

Provider API keys for Auto caption live in the database, encrypted; everything else stays in
the server's `.env`. No endpoint ever returns a key.

| Method | Path | Body | `data` |
|---|---|---|---|
| GET | `/providers?capability=speech_to_text` | — | `[{ provider, capability, configured, active, updatedAt }]` |
| PUT | `/providers/:provider/key` | `{ capability, apiKey }` | `{ configured: true }` |
| DELETE | `/providers/:provider/key?capability=speech_to_text` | — | `{ configured: false }` |
| POST | `/providers/:provider/activate` | `{ capability }` | the list |
| POST | `/providers/:provider/deactivate` | `{ capability }` | the list |
| POST | `/providers/:provider/test` | `{ capability }` | `{ ok, message }` |

`:provider` is `deepgram` or `elevenlabs` (anything else is 422). Activating without a saved
key is 409. Only one provider per capability is active; activating one turns the other off.

## Corrections this file makes to the implementation plan

Found by exercising the live API; the plan predates it:

1. `GET /stats/uploads` → the real route is **`/stats/uploads-over-time`**.
2. `StatsSummary` has **no `publishedCount`/`processingCount`** — read them from `byStatus`.
3. `GET /assets` returns **`meta` beside `data`**, so it needs `apiFetchEnvelope` (Task 13),
   not `apiFetch`. The plan only flagged this for audit-logs.
4. `AuditEntry` also carries **`before`, `after`, `userAgent`**.

Everything else in the plan matched.
