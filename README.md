# SlimShot Admin Dashboard

An admin dashboard for SlimShot: manage audio/font/template assets, categories, system
settings, and browse the audit log. Dark theme only, responsive down to phone
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

The dashboard needs the SlimShot API running locally on port 2700. Run the dashboard on
port 3001 as above — that is the origin the API's `ADMIN_BASE_URL` allows through CORS.

### Running the API

From `../slimshot_server`:

```bash
npm run start:dev
```

### Environment

Copy `.env.example` to `.env` (or `.env.local`) and set the API base URL:

```
NEXT_PUBLIC_API_BASE=http://localhost:2700/api/admin/v1
```

It is inlined at build time, so restart the dev server after changing it. On the API
side, set `ADMIN_BASE_URL` in `slimshot_server/.env` to this dashboard's origin
(`http://localhost:3001` locally).

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
