# Start here

The SlimShot admin dashboard. The API it consumes is built, reviewed and running; this repo
is the UI.

## To begin

```
Execute docs/implementation-plan.md using the superpowers:subagent-driven-development skill.
Read docs/design-spec.md and docs/api-reference.md first. Start at Task 1.
```

## The four documents

| File | What it is |
|---|---|
| `design-spec.md` | The **binding authority**. What to build and why. Approved. |
| `implementation-plan.md` | 13 tasks, ~100 steps, TDD. The argument from the spec. |
| `api-reference.md` | Real shapes captured from the running API, plus dev credentials. **Outranks the plan** where they disagree. |
| `START-HERE.md` | This file. |

## Before writing any code

**Use Context7 for framework docs.** Next.js 16 and Tailwind v4 are both newer than the
model's training data, and guessing produces code that runs while using deprecated APIs.
Already verified this way:

- `middleware.ts` is **deprecated** — the file is `proxy.ts`, exporting `proxy()`.
- `cookies()` is **async**: `const store = await cookies()`.
- Tailwind v4 needs `@theme inline`, not `@theme`, when a token references another CSS variable.

The installed package also ships docs at `node_modules/next/dist/docs/`, which is how those
were first found. Context7 is fresher; prefer it.

## Running the stack

**API** — from `../slimshot_server`:

```bash
npm run start:dev      # binds port 3000
```

**Dashboard** — from here:

```bash
npm run dev -- -p 3001   # 3000 is taken by the API
```

Set `NEXT_PUBLIC_API_BASE=http://localhost:3000/api/admin/v1`.

**Log in as:** `owner@slimshot.dev` / `DevOwner!2026-dashboard`

Owner role is required for Settings — `settings.write` is owner-only and `admin` does not
inherit it.

## Ground rules

- **Never modify `../slimshot_server`** and never run a Prisma command against its database.
  It points at a live Neon instance. The API is shipped; this repo consumes it.
- **Dark theme only.** No light mode, no `dark:` variants.
- **The brand gradient appears in exactly four places**: primary button, active nav
  indicator, focus rings, logo mark. Nowhere else.
- TDD throughout. Failing test, watch it fail for the right reason, then implement.
- One trailer per commit: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## The two tasks that carry the most risk

**Task 4 — auth.** Where the Next 16 changes bite. The access token lives in memory only;
the refresh token is an httpOnly cookie written by a route handler. `withRefresh` retries
exactly once — an unbounded refresh-on-401 loop hangs the UI and hammers the API.

**Task 12 — the secret field.** The most security-sensitive component here. Ten tests pin
what cannot be checked by eye: that the password and revealed value never reach the query
cache or browser storage, that re-locking drops the strings rather than hiding them behind
CSS, that a wrong password is not retried (it spends the account lockout budget), and that
an expired grant re-prompts rather than erroring.

That last one matters because **the 120-second server grant and the 2-minute UI idle lock
are independent clocks that drift.** The UI must never assume its own timer is authoritative.

One thing worth internalising before Task 12: the API's masked value for `redis.url` renders
as `redis://••••7474`. That is a real credential showing its scheme and last four characters.
The dashboard shows a constant `••••••••••` instead — never the API's mask. That is the whole
reason §6.5 is written as it is.

## What is deliberately not built

The API does not expose these, so the UI must not imply them:

- Failed-job introspection and retry — only `GET /jobs/health` exists.
- Storage-provider CRUD.
- Admin user management.
- End-to-end browser tests — the API has its own suite.
