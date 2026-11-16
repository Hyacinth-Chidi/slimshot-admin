# Overview Users and Credits cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** On the Overview, the Users and Credits spent cards replace Processing and Failed.

**Architecture:** Two small, pure readers in `lib/api` feed `StatCards`. The page adds one query (`/stats/users?days=7`) and reuses its 30-day credit stats.

**Tech Stack:** Next.js 16, React Query, Tailwind v4, Vitest with Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-16-overview-users-credits-design.md`

## Global Constraints

- Text stays in the text tokens. An accent colours only the icon chip.
- Numbers use `toLocaleString('en-GB')` (`1,284`).
- Lint passes with no new warnings, `tsc --noEmit` is clean, and every Vitest test passes.

## Review Focus

- Credit stats rows naming a type the dashboard doesn't know count as given when positive, and never as spent.
- Refunds in the window can outweigh its charges, and spent never goes below 0.
- Each card loads on its own and shows a dash until its own data lands.
- The "failed" link stays out of every other link.

---

### Task 1: Readers — `creditTotals` and `fetchUserStats`

**Files:** `lib/api/credits.ts`, `lib/api/credits.test.ts`, `lib/api/stats.ts`, `lib/api/stats.test.ts`

**Interfaces:**
- Produces: `creditTotals(rows: CreditStatsRow[]): { spent: number; given: number }`
- Produces: `interface UserStats { total: number; newInPeriod: number }` and `fetchUserStats(days: number): Promise<UserStats>`, which calls `/stats/users?days=${days}`
- `tileCounts` drops `processing`.

Tests:
- Charges less refunds.
- Free grants count as given; refunds and purchases do not.
- Negative adjustments and forfeits are not spent.
- An empty window gives zero.
- Spent never goes below 0.
- An unknown positive type counts as given.
- `fetchUserStats(7)` calls `/stats/users?days=7`.

### Task 2: `StatCards` — Users, Credits spent, failed on Total assets

**Files:** `components/overview/stat-cards.tsx`, `components/overview/stat-cards.test.tsx`, `app/globals.css`

**Interfaces:**
- Produces: `StatCards({ stats, users, credits })`
- `stats: OverviewStats | undefined`, with `processing` gone
- `users?: { total: number; thisWeek: number }`
- `credits?: { spent: number; given: number; days: number }`

Tests:
- Users: its figure, "+N this week", "No sign-ups this week", and a link to `/users`.
- Credits: its figure, "Last 30 days · N given", "Last 30 days" when nothing was given, and a link to `/credits/pricing`.
- Total assets: calm with no failures. With failures it shows `data-tone="error"` and the "Review 2 failed assets" link to `/audio?status=failed`.
- Every card shows a dash until its own data lands.
- No Processing or Failed card remains.

### Task 3: The Overview page wires both

**Files:** `app/(dashboard)/page.tsx`, `app/(dashboard)/page.test.tsx`

Tests:
- `fetchUserStats` is called with 7.
- The Users card shows the total and this week's count.
- The Credits card shows the 30-day spent figure and the given figure from the same rows the chart uses.
- The heading order is unchanged.
