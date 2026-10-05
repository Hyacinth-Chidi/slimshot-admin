# Credits Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard screens for app users and the credit economy, over the admin API on the server's `feat/accounts-credits` branch.

**Architecture:** Two API modules (`lib/api/users.ts`, `lib/api/credits.ts`) wrap the routes with `withRefresh` + `apiFetch`. A Users list and a Users detail page, two new owner-only Settings tabs (Credits, Pricing), and a credits chart on Overview are built from the existing primitives (shadcn Dialog/Tabs restyled, `Button`, `Input`, `StatusPill`, `DebouncedSearchInput`) and the existing patterns (URL-held filters, `useInfiniteQuery` + Load more, the table/cards split at `md`, the waveform chart).

**Tech Stack:** Next.js 16.3 (App Router, client pages), React, TanStack Query 5, Tailwind v4, shadcn/Radix, Lucide, Vitest + Testing Library + user-event.

**Spec:** `docs/superpowers/specs/2026-10-05-credits-admin-design.md` (binding). API shapes: `../slimshot_server/docs/admin-credits-api.md` (wins on shapes).

**Plan format:** compact, as the owner asked for speed (the same format as the server's Milestones 2–4): each task gives files, exact interfaces, the test cases to write first and the commit. Copy (labels, messages) is quoted from the spec section named; it is not repeated here.

## Global Constraints

- Never modify `../slimshot_server`; never run anything against its database.
- Dark design system only: `--bg` page, `--surface` cards, `--elevated` inputs/hover; borders, not shadows. The brand gradient only where it already is (primary button, active nav indicator, focus ring, logo); destructive actions use `Button variant="danger"`.
- Dialogs, sheets, menus, tabs come from `components/ui/*` (shadcn/Radix). Never hand-roll a modal.
- Below `md` lists are cards (`md:hidden`), at `md`+ a real `<table>` (`hidden md:block`), each with a `data-testid`.
- Client pages start with `'use client'`; the dynamic route reads its id with `useParams<{ id: string }>()` from `next/navigation` (Next 16 docs: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-params.md`).
- Every API call goes through `withRefresh(() => apiFetch<T>(path, init))`; path segments from data are wrapped in `encodeURIComponent`.
- Query errors are toasted globally (`app/providers.tsx`); mutation errors are handled in the component: toast the `ApiError.message`, map a 422 with `fieldErrors`, `console.error` the traceId.
- Numbers shown with `toLocaleString('en-GB')`; negative amounts with the minus sign `−` (U+2212); dates `en-GB`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push or merge; the owner tests first.
- Commands: one file `npx vitest run <path>`; all `npm test`; lint `npm run lint`; types `npx tsc --noEmit`; build `npm run build`.

## Review Focus

1. **A user with no username or no email** (unclaimed, or deleted and erased): list and detail show *Not claimed yet* / `—` instead of `null` or a crash; the delete confirmation falls back to the username, then the id. Pinned in Tasks 2 and 4.
2. **Removing more credits than the balance shown:** the preview says the balance would go below zero and the submit stays disabled; a stale balance still gets the server's 422 inline. Pinned in Task 4.
3. **A price with only the open-ended tier** (all tiers removed): a valid flat price, sent as `tiers: [{ upToSeconds: null, credits }]`. Pinned in Task 6.
4. **Pasted domain lists** with mixed case, commas, spaces or duplicates: normalised to one lowercase domain each, and an unchanged list is not sent. Pinned in Task 5.
5. **A search term with spaces or `&`** (`ann lee&co`): encoded in the request and the URL, and the same results after reload. Pinned in Tasks 1 and 2.

---

### Task 1: Data layer, permissions, status pill

**Files:** Create `lib/api/users.ts` (+ `users.test.ts`), `lib/api/credits.ts` (+ `credits.test.ts`), `lib/auth/permissions.ts` (+ `permissions.test.ts`); modify `components/ui/status-pill.tsx` (+ its test).

**Interfaces (produced):**

```ts
// lib/api/users.ts
export type UserStatus = 'active' | 'suspended' | 'deleted';
export interface UserSummary { id: string; email: string | null; username: string | null; accountStatus: UserStatus; creditBalance: number; createdAt: string; claimedAt: string | null }
export interface UserDetail extends UserSummary { referralCode: string | null; deletedAt: string | null; signInMethods: { google: boolean; email: boolean } }
export interface LedgerEntry { id: string; type: string; amount: number; balanceAfter: number; createdAt: string }
export interface Page<T> { items: T[]; nextCursor: string | null }
export function searchUsers(p: { q?: string; cursor?: string; limit?: number }): Promise<Page<UserSummary>>; // GET /users?q=&cursor=&limit= (only the params given, URLSearchParams)
export function fetchUser(id: string): Promise<UserDetail>;                     // GET /users/{id}
export function fetchUserLedger(id: string, p: { cursor?: string; limit?: number }): Promise<Page<LedgerEntry>>; // GET /users/{id}/ledger?…
export function adjustCredits(id: string, amount: number, reason: string): Promise<{ balance: number }>; // POST /users/{id}/adjustments {amount, reason}
export function suspendUser(id: string, reason: string): Promise<UserDetail>;   // POST /users/{id}/suspend {reason}
export function unsuspendUser(id: string): Promise<UserDetail>;                 // POST /users/{id}/unsuspend (no body)
export function deleteUser(id: string, reason: string): Promise<{ deleted: true }>; // DELETE /users/{id} {reason}

// lib/api/credits.ts
export type CreditTxType = 'signup_bonus' | 'referral_inviter' | 'referral_invitee' | 'rewarded_ad' | 'feature_charge' | 'feature_refund' | 'admin_adjustment' | 'account_deleted' | 'purchase';
export const LEDGER_LABELS: Record<CreditTxType, string>;                       // spec §5.2 table (shared by the history and the chart)
export function ledgerLabel(type: string): string;                              // unknown → the code itself
export interface CreditSettings { id: string; signupBonusCredits: number; adRewardCredits: number; adDailyCap: number; referralInviterCredits: number; referralInviteeCredits: number; referralCapCount: number; referralCapDays: number; ipSignupLimitPer24h: number; disposableEmailDomains: string[]; otpMaxAttempts: number; otpResendCooldownSeconds: number; otpPerEmailPerHour: number; otpPerDevicePerHour: number; otpPerIpPerHour: number; updatedById: string | null; updatedAt: string }
export type CreditSettingsPatch = Partial<Omit<CreditSettings, 'id' | 'updatedById' | 'updatedAt'>>;
export function fetchCreditSettings(): Promise<CreditSettings>;                 // GET /credit-settings
export function updateCreditSettings(patch: CreditSettingsPatch): Promise<CreditSettings>; // PUT /credit-settings
export type CreditFeature = 'auto_captions';
export type PricingMode = 'per_job' | 'duration_tiers';
export interface PriceTier { upToSeconds: number | null; credits: number }
export interface PricingRule { id: string; feature: CreditFeature; version: number; mode: PricingMode; perJobCredits: number | null; tiers: PriceTier[] | null; isActive: boolean; note: string | null; createdById: string; createdAt: string; activatedAt: string | null }
export interface NewPricingRule { feature: CreditFeature; mode: PricingMode; perJobCredits?: number; tiers?: PriceTier[]; note?: string }
export function fetchPricingRules(feature: CreditFeature): Promise<PricingRule[]>; // GET /pricing-rules?feature=
export function createPricingRule(rule: NewPricingRule): Promise<PricingRule>;   // POST /pricing-rules
export function activatePricingRule(id: string): Promise<PricingRule[]>;          // POST /pricing-rules/{id}/activate
export interface BalanceMismatch { userId: string; cached: number; ledger: number }
export function checkBalances(): Promise<{ mismatches: BalanceMismatch[] }>;      // GET /credits/reconciliation
export interface CreditStatsRow { day: string; type: string; granted: number; spent: number }
export function fetchCreditStats(days: number): Promise<CreditStatsRow[]>;        // GET /stats/credits?days=
export interface CreditDay { date: string; granted: number; spent: number; byType: Record<string, { granted: number; spent: number }> }
export function creditDays(rows: CreditStatsRow[], days: number, today?: Date): CreditDay[]; // zero-filled, oldest first, ending today (UTC), like zeroFill in lib/api/stats.ts

// lib/auth/permissions.ts
export type AdminRole = AdminProfile['role'];
export function canManageUsers(role: AdminRole | undefined): boolean;   // admin, owner
export function canManageCredits(role: AdminRole | undefined): boolean; // owner

// components/ui/status-pill.tsx — `status: AssetStatus | UserStatus`; active → success tone "Active", suspended → warning tone "Suspended", deleted → subtle tone "Deleted".
```

- [ ] **Step 1: Failing tests** (pattern of `lib/api/providers.test.ts`: mock `apiFetch`, `withRefresh` passes through):
  - `searchUsers({ q: 'ann lee&co', limit: 20 })` calls `/users?q=ann+lee%26co&limit=20`; with no params calls `/users`.
  - `fetchUser('a/b')` encodes the id; `fetchUserLedger('u1', { cursor: 'c1' })` → `/users/u1/ledger?cursor=c1`.
  - `adjustCredits('u1', -20, 'Chargeback')` POSTs `{"amount":-20,"reason":"Chargeback"}`; `unsuspendUser` POSTs with no body; `deleteUser` sends DELETE with `{"reason":…}`.
  - `ledgerLabel('rewarded_ad')` → *Rewarded ad*; `ledgerLabel('new_thing')` → `new_thing`.
  - `fetchPricingRules('auto_captions')` → `/pricing-rules?feature=auto_captions`; `createPricingRule` POSTs the body as given; `activatePricingRule('r 1')` encodes the id; `updateCreditSettings({ adDailyCap: 5 })` PUTs `{"adDailyCap":5}`; `fetchCreditStats(30)` → `/stats/credits?days=30`; `checkBalances` → `/credits/reconciliation`.
  - `creditDays` with rows on two of three days and two types on one day → three days, oldest first, sums per day, `byType` per day, zeros on the empty day.
  - permissions: each of owner/admin/editor/viewer/undefined against both rules.
  - status pill: the three user statuses render their labels.
- [ ] **Step 2:** run `npx vitest run lib/api/users.test.ts lib/api/credits.test.ts lib/auth/permissions.test.ts components/ui/status-pill.test.tsx` → FAIL (modules missing).
- [ ] **Step 3:** implement. **Step 4:** the same command → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5:** commit `feat: API clients for app users and credits, role rules and user status pills`.

### Task 2: Navigation and the Users list

**Files:** Modify `components/shell/nav-items.ts`, `components/shell/app-shell.test.tsx`; create `app/(dashboard)/users/page.tsx`, `components/users/format.ts` (+ test), `components/users/users-page-content.tsx` (+ test), `components/users/user-table.tsx`, `components/users/user-card.tsx`.

**Interfaces:**
- Consumes Task 1: `searchUsers`, `UserSummary`, `StatusPill`. 20 users per page.
- Produces: `components/users/format.ts` → `displayName(u: { username: string | null }): string` (*Not claimed yet* when null), `formatCredits(n: number): string`, `formatSigned(n: number): string` (`+12`, `−12`, `0`), `formatDate(iso: string): string`, `formatDateTime(iso: string): string`; `userHref(id: string, q?: string): string` → `/users/{id}` plus `?q=` when a search is active.
- `NAV_ITEMS` order: Overview, Assets, **Users** (`/users`, Lucide `Users`), Categories, Audit log.
- `app/(dashboard)/users/page.tsx` is a server component wrapping `<UsersPageContent />` in `<Suspense>` exactly like `app/(dashboard)/audit/page.tsx` (`useSearchParams` needs the boundary or `next build` fails).

- [ ] **Step 1: Failing tests:**
  - app-shell: `NAV_ITEMS` has 5 items in the order above.
  - format: `formatSigned(-12)` → `−12`, `formatSigned(5)` → `+5`, `formatCredits(1234567)` → `1,234,567`, `displayName({ username: null })` → *Not claimed yet*, `userHref('u1', 'ann lee')` → `/users/u1?q=ann+lee`.
  - users page content (mock `next/navigation` as in `audit-page-content.test.tsx`; mock `searchUsers`): rows render in `users-table` (a real `<table>`, class `hidden md:block` on the wrapper) and `users-cards` (`md:hidden`); a deleted, unclaimed user shows *Not claimed yet* and `—` for the email; typing a search calls `router.replace` with `/users?q=ann+lee%26co` (debounced, as in assets); `searchUsers` is called with the URL's `q`; empty states per spec §4 for no search and for a search; **Load more** appears with a `nextCursor` and fetches the next page with it.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS for `components/users components/shell lib/api`; `npx tsc --noEmit`.
- [ ] **Step 5:** commit `feat: Users list with search, table and cards, and a Users tab`.

### Task 3: User detail page and credit history

**Files:** Create `app/(dashboard)/users/[id]/page.tsx`, `components/users/user-detail-content.tsx` (+ test), `components/users/user-header.tsx`, `components/users/credit-history.tsx` (+ test), `components/users/user-actions.tsx` (+ test).

**Interfaces:**
- Consumes: Task 1 `fetchUser`, `fetchUserLedger`, `ledgerLabel`, `canManageUsers`; Task 2 format helpers; `useProfile()` from `lib/auth/profile`.
- Produces: `UserDetailContent({ id }: { id: string })`; `UserActions({ user, role }: { user: UserDetail; role: AdminRole | undefined })` rendering nothing unless `canManageUsers(role)` and the user is not deleted; buttons *Adjust credits*, *Suspend* (active) or *Unsuspend* (suspended), *Delete user* (danger). Each button sets local state `open: 'adjust' | 'suspend' | 'unsuspend' | 'delete' | null`; Task 4 mounts the dialogs on that state.
- Query keys: `['users', 'detail', id]`, `['users', 'ledger', id]` (infinite, 20 per page).
- Back link: `/users` plus the `q` from this page's search params (Task 2 links rows with `userHref`).
- `app/(dashboard)/users/[id]/page.tsx`: `'use client'`; `const { id } = useParams<{ id: string }>()`; returns `<Suspense fallback={…Loading user…}><UserDetailContent id={id} /></Suspense>` (the content reads `useSearchParams`).

- [ ] **Step 1: Failing tests:**
  - detail content: header shows username, email, status pill, the balance, joined/claimed dates, referral code, *Google* and *Email* chips only for methods that are true, *Deleted on …* for a deleted user; an `ApiError` with status 404 shows *This user does not exist* and a link to `/users`.
  - credit history: labels from `ledgerLabel`, `+5` with the success class and `−3` without it, the balance after, Load more with the cursor.
  - user actions: nothing for viewer and editor; for admin on an active user *Adjust credits*, *Suspend*, *Delete user*; on a suspended user *Unsuspend* instead of *Suspend*; nothing on a deleted user for the owner.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS for `components/users`; `npx tsc --noEmit`.
- [ ] **Step 5:** commit `feat: user detail page with credit history and role-gated actions`.

### Task 4: Adjust, suspend, unsuspend and delete dialogs

**Files:** Create `components/users/adjust-credits-dialog.tsx` (+ test), `components/users/suspend-dialog.tsx` (+ test), `components/users/unsuspend-dialog.tsx` (+ test), `components/users/delete-user-dialog.tsx` (+ test), `components/users/use-user-mutation.ts`; modify `components/users/user-actions.tsx` to mount them.

**Interfaces:**
- Consumes: Task 1 `adjustCredits`, `suspendUser`, `unsuspendUser`, `deleteUser`, `ApiError`, `fieldErrors`; `toast` from `lib/use-toast`.
- Produces: `AdjustCreditsDialog`, `SuspendDialog`, `UnsuspendDialog`, `DeleteUserDialog`, each `({ user, open, onOpenChange }: { user: UserDetail; open: boolean; onOpenChange: (open: boolean) => void })`; `confirmationTarget(user): string` (email, else username, else id) and `matchesConfirmation(typed: string, target: string): boolean` (trimmed, case-insensitive), both exported from `delete-user-dialog.tsx`.
- `useUserMutation(fn, { success: string })`: on success toasts `success`, invalidates `['users']` (prefix: list, detail and history) and closes; on a 404 or 409 toasts the server message, invalidates `['users']`, closes; a 422 is returned to the dialog to show inline; otherwise toasts the message and logs the traceId.
- Copy, bounds and behaviour: spec §5.3. Success toasts: *Credits adjusted*, *User suspended*, *Suspension lifted*, *User deleted*.

- [ ] **Step 1: Failing tests** (user-event):
  - adjust: *Remove* 20 with a valid reason calls `adjustCredits(id, -20, reason)`; *Add* 5 → `5`; *New balance: 117* from a balance of 112 and Add 5; Remove 200 from 112 shows the below-zero line and disables submit; a 422 with `details.balance: 12` keeps the dialog open and shows the line with 12; reason under 3 characters disables submit.
  - suspend: sends the reason; shows the spec's one-sentence consequence. Unsuspend: confirm calls `unsuspendUser`.
  - delete: the button stays disabled until the email is typed (`  ANN@Example.com ` matches `ann@example.com`); a user with no email confirms with the username; one with neither with the id; success calls `deleteUser(id, reason)`.
  - a 409 from suspend toasts the message and closes.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS for `components/users`; `npx tsc --noEmit`.
- [ ] **Step 5:** commit `feat: adjust, suspend, unsuspend and delete dialogs for app users`.

### Task 5: Settings → Credits tab and the balance check

**Files:** Create `components/settings/credit-settings-form.ts` (+ test), `components/settings/credits-tab.tsx` (+ test), `components/settings/balance-check.tsx` (+ test); modify `app/(dashboard)/settings/page.tsx` (+ its test).

**Interfaces:**
- Consumes: Task 1 `fetchCreditSettings`, `updateCreditSettings`, `checkBalances`, `CreditSettings`, `CreditSettingsPatch`.
- Produces (`credit-settings-form.ts`): `CREDIT_FIELD_GROUPS: Array<{ title: string; fields: Array<{ key: NumericSettingKey; label: string; min: number; max: number }> }>` (spec §6.1 table, in order); `type NumericSettingKey = Exclude<keyof CreditSettingsPatch, 'disposableEmailDomains'>`; `normalizeDomains(text: string): string[]` (split on newlines, commas and spaces; trim; lowercase; drop blanks; de-duplicate keeping first order); `type FormValues = Record<NumericSettingKey, string> & { domains: string }`; `toFormValues(s: CreditSettings): FormValues`; `changedFields(initial: CreditSettings, form: FormValues): CreditSettingsPatch` (numbers parsed; domains compared after normalising; only differences).
- Settings page: tabs *Providers*, *Credits* (Pricing joins in Task 6), all inside the existing owner-only branch.
- Query key `['credits', 'settings']`; the balance check is a `useMutation` run by the button, never on mount.

- [ ] **Step 1: Failing tests:**
  - form helpers: `normalizeDomains('Mailinator.com, foo.com\n\nfoo.com  BAR.io')` → `['mailinator.com', 'foo.com', 'bar.io']`; `changedFields` returns `{}` for an untouched form, `{ adDailyCap: 5 }` after one edit, and omits domains when only case or order of duplicates changed.
  - credits tab: renders the four group titles and every field label with the loaded values; Save disabled until a change; saving sends only the changed field; a 422 `["adDailyCap must not be greater than 1000"]` shows under that field; *Last changed …* from `updatedAt`.
  - balance check: no request on mount; click → *Every balance matches its history* for none; mismatches list links to `/users/{userId}` with *stored N · history M*.
  - settings page: the owner sees *Providers* and *Credits* tabs; a viewer sees neither and fires neither query.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS for `components/settings app`; `npx tsc --noEmit`.
- [ ] **Step 5:** commit `feat: Credits settings tab with the balance check`.

### Task 6: Settings → Pricing tab

**Files:** Create `components/settings/pricing-format.ts` (+ test), `components/settings/pricing-tab.tsx` (+ test), `components/settings/price-dialog.tsx` (+ test); modify `app/(dashboard)/settings/page.tsx` (+ its test).

**Interfaces:**
- Consumes: Task 1 pricing functions and types.
- Produces (`pricing-format.ts`):
  - `describeLength(seconds: number): string` — under 60 → `45 s`; otherwise hours, minutes and seconds with zero parts left out: `60` → `1 min`, `90` → `1 min 30 s`, `300` → `5 min`, `3600` → `1 h`, `3725` → `1 h 2 min 5 s`.
  - `describeRule(rule: Pick<PricingRule, 'version' | 'mode' | 'perJobCredits' | 'tiers'>): string` — per job: `v2 · 3 credits per job` (`1 credit` singular); tiers: `v3 · up to 1 min → 2 credits · up to 5 min → 5 · longer → 10` (the unit word only on the first tier; the open-ended tier reads `longer`; a single open-ended tier reads `v4 · 7 credits per job of any length`).
  - `draftProblems(draft: PriceDraft): string[]` mirroring the server: whole numbers; seconds 1–86400 and each greater than the row before; credits 0–100000; at most 50 tiers in all; per job needs credits.
  - `type PriceDraft = { mode: PricingMode; perJob: string; rows: Array<{ upTo: string; credits: string }>; longer: string; note: string }`; `toNewRule(draft: PriceDraft): NewPricingRule` (rows then `{ upToSeconds: null, credits: longer }`; `feature: 'auto_captions'`; note omitted when blank).
- `PriceDialog({ open, onOpenChange })`: spec §7. *Activate now* ticked by default: `createPricingRule` then `activatePricingRule(created.id)`; invalidates `['pricing']`; a 422's `details.problems` shown as a list.
- `PricingTab()`: query `['pricing', 'auto_captions']`; current price card or the no-price warning; history with *Active* badge or **Activate** behind a confirm dialog (spec §7 copy, with the version number).
- Settings page tabs: *Providers*, *Credits*, *Pricing*.

- [ ] **Step 1: Failing tests:**
  - format: the `describeLength` cases above; both `describeRule` shapes plus the single open-ended tier; `draftProblems` flags a second tier not longer than the first, seconds `0`, credits `-1`, `1.5`; `toNewRule` for tiers ends with `upToSeconds: null`; removing every row leaves `tiers: [{ upToSeconds: null, credits: 7 }]` with no problems.
  - dialog: per-job submit sends `{ feature: 'auto_captions', mode: 'per_job', perJobCredits: 3 }` then activates; unticking *Activate now* skips activation; a tier problem disables submit and lists the problem; the server's `details.problems` are listed.
  - tab: the active rule's summary; the no-price warning when none is active; **Activate** on an inactive version → confirm → `activatePricingRule(id)`.
  - settings page: the owner sees the *Pricing* tab.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS for `components/settings app`; `npx tsc --noEmit`.
- [ ] **Step 5:** commit `feat: Pricing tab with versioned caption prices and a tier editor`.

### Task 7: Overview credits chart and audit log entries

**Files:** Create `components/overview/credits-waveform.tsx` (+ test); modify `app/(dashboard)/page.tsx` (+ `page.test.tsx`), `lib/activity-copy.ts` (+ test), `components/audit/audit-list.tsx` (+ test).

**Interfaces:**
- Consumes: Task 1 `fetchCreditStats`, `creditDays`, `CreditDay`, `ledgerLabel`; the interaction model of `components/overview/upload-waveform.tsx` (read it first; load the `dataviz` skill before writing chart code).
- Produces: `CreditsWaveform({ days, refreshing }: { days: CreditDay[] | undefined; refreshing?: boolean })` — one column per day on a centre baseline, granted up and spent down on one shared scale; playhead by pointer and arrow keys showing the day, *granted N · spent M* and the non-zero types with `ledgerLabel`; totals *Granted* and *Spent* for the window. `data-testid="credits-day"` on each column with `data-granted` and `data-spent`.
- Overview: query `['stats', 'credits', 30]`, the panel full-width below the uploads row.
- `describeActivity`: the 8 actions of spec §9. Audit list: when `entityType === 'User'` and `entityId` is set, the entity text is a `Link` to `/users/{entityId}` in both the desktop and phone layouts.

- [ ] **Step 1: Failing tests:**
  - waveform: 30 columns from `creditDays`; a day with granted 10 and spent 4 has its up-bar taller than its down-bar; totals show the sums; ArrowLeft/ArrowRight move the readout to the neighbouring day and it lists *Rewarded ad* for that day; `undefined` renders the loading state.
  - overview page: requests `fetchCreditStats(30)` and renders the panel.
  - activity copy: each of the 8 actions has its text; `credits.reconcile.mismatch` has the error tone.
  - audit list: a `User` entry links to `/users/u1`; other entity types stay plain text.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS for `components/overview components/audit lib app`; `npx tsc --noEmit`.
- [ ] **Step 5:** commit `feat: credits chart on Overview and readable audit entries for credits`.

### Task 8: Final verification

- [ ] `npm test && npm run lint && npx tsc --noEmit && npm run build`, each read to the end; `git status` clean apart from the Next.js agent block noted in `AGENTS.md` if `next dev` re-added it; then the executing-plans final review.
