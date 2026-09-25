# SlimShot Admin Dashboard

An admin dashboard for SlimShot: manage audio/font/template assets, categories, storage
and auth settings, and browse the audit log. Dark theme only, responsive down to phone
width (see `docs/design-spec.md`).

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) — see `node_modules/next/dist/docs/`
  for this version's conventions before assuming anything from older Next.js docs.
- React 19, TypeScript (strict)
- [Tailwind CSS v4](https://tailwindcss.com)
- [TanStack Query v5](https://tanstack.com/query) for server state
- [shadcn/ui](https://ui.shadcn.com) (Radix underneath) for dialogs, sheets, dropdown
  menus and other interactive primitives, restyled to this project's tokens

## Getting started

```bash
npm install
npm run dev -- -p 3001
```

The dashboard needs the SlimShot API running locally. The API binds port 3000 (the same
default Next.js uses), so run the dashboard on another port as above.

### Running the API

From `../slimshot_server`:

```bash
npm run start:dev
```

### Environment

Set the dashboard's API base URL:

```
NEXT_PUBLIC_API_BASE=http://localhost:3000/api/admin/v1
```

### Signing in

Sign-in requires an admin account on the API. Reaching **Settings** specifically requires
an **owner** account — `settings.write` is owner-only and a regular `admin` account does
not inherit it. See `../slimshot_server`'s own docs (or `docs/api-reference.md` in this
repo, for local development only) for a seeded account to sign in with.

## Scripts

```bash
npm test         # vitest — unit/component tests
npm run lint     # eslint
npm run build    # production build (also typechecks)
```

For a standalone type check without a full build: `npx tsc --noEmit`.
