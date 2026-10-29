# Admin layout redesign — Phase 1: Credits pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace System › Credits (Rules/Pricing tabs) with a Credits sidebar group (Pricing, Earning) and a System › Sign-in security page, as approved in the mockup, and fix the System pages' hydration error.

**Architecture:** New owner-only pages under `app/(dashboard)/credits/*` and `app/(dashboard)/system/security`, built from small components in `components/credits/` and `components/security/`. Price arithmetic stays in `components/settings/pricing-format.ts`, which already mirrors the server's formula, and is extended rather than duplicated. One generic `SettingCard` renders every sentence-style settings card and saves only its own changed fields. The navigation switch and the redirect from `/system/credits` land last, so the branch is navigable after every task.

**Tech Stack:** Next.js 16.3 (App Router, `proxy.ts`), React 19, TanStack Query 5, Tailwind v4, shadcn/ui on `radix-ui`, lucide-react, Vitest 5 + Testing Library + user-event.

**Spec:** `docs/superpowers/specs/2026-10-29-admin-layout-redesign-design.md` (§4, §5, §7.1–7.4, §7.10). Mockup: `../.superpowers/brainstorm/1155-1793265268/content/admin-redesign-v2.html` (screens 1–4).

**Depends on:** `slimshot_server` plan `docs/superpowers/plans/2026-10-29-admin-layout-reads.md` (`createdBy` on pricing rules, `lastChanged` on credit settings). The UI treats both as optional, so tests use fixtures and nothing breaks against an older server.

## Global Constraints

- **Context7 before framework code** (Next 16, React 19, TanStack Query, Radix). Next 16: `proxy.ts` not `middleware.ts`; `cookies()` is async.
- UI primitives from `components/ui/*` (shadcn/Radix): Sheet, Dialog, DropdownMenu, Select, Switch. Never hand-rolled.
- Every first-load state is a content-shaped skeleton (`components/ui/skeleton.tsx`), never "Loading…".
- Dark only; tokens from `app/globals.css`. The brand gradient only on: primary button, active nav indicator, focus rings, logo mark. Selected/edited states use `--brand-from` as a border colour plus a 10% tint, never the gradient.
- Dates: `en-GB` via `lib/format.ts` (Task 1): "29 Oct 2026", "29 Oct 2026, 14:05", short "27 Oct".
- Copy is plain English: no "ticket", "finalize", "upper bound", "tier" in UI text (use "band").
- Touch targets ≥ 44px below `md` (existing `Button` sizes do this).
- Owner-only pages render inside `OwnerOnly`; their queries never fire for non-owners.
- Commits: conventional, plain English, ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch `feat/layout-redesign` from `main`.
- `npm test`, `npm run lint` and `npx tsc --noEmit` green after every task.

## Review Focus

1. **Two Earning cards edited, one saved**: the other card keeps its unsaved values and stays dirty after the saved settings come back. → Task 8 test.
2. **A card save refused with 422 on one field**: the message shows under that field, the card stays dirty with the typed value, and nothing else on the page changes. → Task 8 test.
3. **No live price** (no rules, or none active): Pricing shows the warning and **Set a price**; the sheet opens in "By time used" with empty fields; Now column shows "—" with no rise callout; the sign-up hint on Earning leaves out the "≈ … of captions" line. → Tasks 4, 7, 8 tests.
4. **A half-typed price** (an empty or invalid field): the New column shows "—", no callout, **Make vN live…** and **Save for later** are disabled, and the problems list says why. → Task 5 test.
5. **Leaving with unsaved edits**: closing the sheet (X, Escape, overlay click) with changes asks first; a dirty settings card registers `beforeunload`. → Tasks 5, 8 tests.

---

### Task 1: Shared types and date formatting

**Files:**
- Create: `lib/format.ts`, `lib/format.test.ts`
- Modify: `lib/api/types.ts`, `lib/api/credits.ts`

**Interfaces:**
- Produces:
  - `lib/api/types.ts`: `export interface AdminRef { id: string; email: string; name: string }`
  - `lib/api/credits.ts`: `PricingRule` gains `createdBy?: AdminRef | null`; `CreditSettings` gains `lastChanged?: Partial<Record<keyof CreditSettingsPatch, { at: string; by: AdminRef | null }>>`.
  - `lib/format.ts`: `formatDate(iso: string, timeZone?: string): string` → "29 Oct 2026"; `formatDateTime(iso, timeZone?)` → "29 Oct 2026, 14:05"; `formatShortDate(iso, timeZone?)` → "27 Oct". All `en-GB`; invalid input → "—". `timeZone` defaults to the viewer's own (undefined).

- [ ] **Step 1: Write the failing tests** (`lib/format.test.ts`, always passing `'UTC'`)

```ts
expect(formatDate('2026-10-29T14:05:00Z', 'UTC')).toBe('29 Oct 2026');
expect(formatDateTime('2026-10-29T14:05:00Z', 'UTC')).toBe('29 Oct 2026, 14:05');
expect(formatShortDate('2026-10-27T09:00:00Z', 'UTC')).toBe('27 Oct');
expect(formatDate('not a date', 'UTC')).toBe('—');
```

- [ ] **Step 2: Run** `npx vitest run lib/format.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `lib/format.ts` (`Intl.DateTimeFormat('en-GB', …)`) and add the types.
- [ ] **Step 4: Run** `npx vitest run lib/format.test.ts && npx tsc --noEmit`. Expected: PASS, no type errors.
- [ ] **Step 5: Commit** `feat: one date format for the dashboard, and the admin fields the server now sends`

---

### Task 2: Phone-only section tabs and the hydration fix

**Files:**
- Create: `lib/use-mounted.ts`, `components/credits/credits-header.tsx`, `components/system/system-header.test.tsx`
- Modify: `components/system/system-header.tsx`, `components/shell/page-header.tsx`, `components/shell/page-header.test.tsx`

**Interfaces:**
- Produces:
  - `useMounted(): boolean`: `false` on the server and during hydration, `true` after (`useSyncExternalStore` with server snapshot `false`).
  - `SectionTabs` gains `phoneOnly?: boolean` (adds `md:hidden`).
  - `SystemHeader({ title, subtitle? })`: owner tabs AI providers `/system/providers`, Sign-in security `/system/security`, Audit log `/system/audit`, `phoneOnly`, rendered only when `useMounted()` and the role is owner.
  - `CreditsHeader({ title, subtitle?, actions? })`: crumbs "Credits", tabs Pricing `/credits/pricing`, Earning `/credits/earning`, `phoneOnly`.
  - `PageHeader` gains `subtitle?: string` (muted line under the title).

- [ ] **Step 1: Write the failing tests**

```ts
// system-header.test.tsx — the hydration requirement (spec §5)
it('renders the same first markup whether or not the profile is already cached', () => {
  const cold = renderToString(wrap(new QueryClient()));                 // react-dom/server
  const warm = new QueryClient(); warm.setQueryData(['auth', 'me'], { id: 'a1', email: 'o@x', name: 'O', role: 'owner' });
  expect(renderToString(wrap(warm))).toBe(cold);
});
it('shows the owner the three System tabs once mounted, on phones only', async () => {
  // render (client) with owner profile → nav "System sections" has links AI providers, Sign-in security, Audit log; nav has class md:hidden
});
// page-header.test.tsx
it('shows a subtitle under the title', ...)
it('hides phone-only tabs from md up', ...)   // SectionTabs phoneOnly → className contains 'md:hidden'
```

Mock `next/navigation`'s `usePathname` as the existing shell tests do.

- [ ] **Step 2: Run** `npx vitest run components/system components/shell/page-header.test.tsx`. Expected: the markup test FAILS against today's `SystemHeader` (warm render includes the `<nav>`). Confirm that failure before fixing.
- [ ] **Step 3: Implement** `useMounted`, the `SectionTabs`/`PageHeader` props, `SystemHeader` and `CreditsHeader`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `fix: System pages render the same on the server and in the browser; section tabs on phones only`

---

### Task 3: Price arithmetic for clip costs, coverage and plain sentences

**Files:**
- Modify: `components/settings/pricing-format.ts`, `components/settings/pricing-format.test.ts`

**Interfaces:**
- Consumes: existing `priceBySecond`, `describeLength`, `PriceDraft`, `draftProblems`, `toNewRule`.
- Produces:
  - `export type RuleLike = Pick<PricingRule, 'mode' | 'perJobCredits' | 'tiers' | 'blockSeconds' | 'blockCredits' | 'minCredits'>`
  - `export const SAMPLE_SECONDS = [15, 30, 60, 180, 300, 600] as const`
  - `export function priceFor(rule: RuleLike, seconds: number): number`: per job → `perJobCredits`; bands → the first band with `upToSeconds === null || seconds <= upToSeconds` (bounds included, as the server); per second → `priceBySecond`.
  - `export function coverage(rule: RuleLike, credits: number): number | null`: the longest clip, in seconds, whose cost is ≤ `credits`; `Infinity` when every length is affordable; `null` when none is.
  - `export function describeCoverage(seconds: number | null): string`: "any length" for `Infinity`, `describeLength` otherwise, "nothing" for `null`.
  - `export function describePrice(rule: RuleLike): string`: the plain sentence (exact copy below).
  - `export function ruleToDraft(rule: RuleLike | null): PriceDraft`: `null` → empty draft in `per_second` mode; `note` always ''.
  - `export function draftToRule(draft: PriceDraft): RuleLike | null`: `null` while `draftProblems(draft)` is non-empty.
  - `export interface CostRow { seconds: number; now: number | null; next: number | null }`
  - `export function costRows(now: RuleLike | null, next: RuleLike | null): CostRow[]` over `SAMPLE_SECONDS`.
  - `export function largestIncreasePct(rows: CostRow[]): number | null`: max of `round((next - now) / now * 100)` over rows where both are set, `now > 0` and `next > now`; `null` if none.

- [ ] **Step 1: Write the failing tests** with the spec's values

```ts
const v3: RuleLike = { mode: 'per_second', blockSeconds: 30, blockCredits: 2, minCredits: 4, perJobCredits: null, tiers: null };
const v4: RuleLike = { ...v3, blockCredits: 3 };
const v2: RuleLike = { mode: 'duration_tiers', tiers: [{ upToSeconds: 60, credits: 5 }, { upToSeconds: 180, credits: 10 }, { upToSeconds: null, credits: 20 }], perJobCredits: null, blockSeconds: null, blockCredits: null, minCredits: null };
const v1: RuleLike = { mode: 'per_job', perJobCredits: 10, tiers: null, blockSeconds: null, blockCredits: null, minCredits: null };

expect(SAMPLE_SECONDS.map((s) => priceFor(v3, s))).toEqual([4, 4, 4, 12, 20, 40]);
expect(SAMPLE_SECONDS.map((s) => priceFor(v4, s))).toEqual([4, 4, 6, 18, 30, 60]);
expect([priceFor(v2, 60), priceFor(v2, 61), priceFor(v2, 600)]).toEqual([5, 10, 20]);
expect([coverage(v3, 5), coverage(v4, 5), coverage(v3, 100), coverage(v3, 3)]).toEqual([60, 30, 1500, null]);
expect([coverage(v2, 5), coverage(v2, 20), coverage(v1, 10), coverage(v1, 9)]).toEqual([60, Infinity, Infinity, null]);
expect(describeCoverage(1500)).toBe('25 min');
expect(describePrice(v3)).toBe('2 credits for every 30 seconds started · never less than 4 credits');
expect(describePrice({ ...v3, minCredits: null })).toBe('2 credits for every 30 seconds started');
expect(describePrice(v2)).toBe('5 credits up to 1 min · 10 up to 3 min · 20 for anything longer');
expect(describePrice(v1)).toBe('10 credits per clip, any length');
expect(largestIncreasePct(costRows(v3, v4))).toBe(50);
expect(largestIncreasePct(costRows(v3, v3))).toBeNull();
expect(costRows(null, v3)[0]).toEqual({ seconds: 15, now: null, next: 4 });
expect(ruleToDraft(v3)).toMatchObject({ mode: 'per_second', blockSeconds: '30', blockCredits: '2', minCredits: '4', note: '' });
expect(draftToRule({ ...ruleToDraft(v3), blockCredits: '' })).toBeNull();
```

- [ ] **Step 2: Run** `npx vitest run components/settings/pricing-format.test.ts`. Expected: FAIL (not exported).
- [ ] **Step 3: Implement** the functions. `coverage` per mode: per job → `Infinity` if `perJobCredits <= credits` else `null`; bands → `Infinity` if the open band is affordable, else the largest `upToSeconds` among affordable bands, else `null`; per second → `null` if `minCredits > credits` or `blockCredits > credits`, `Infinity` if `blockCredits === 0`, else `floor(credits / blockCredits) * blockSeconds`.
- [ ] **Step 4: Run** the same command. Expected: PASS (existing tests too).
- [ ] **Step 5: Commit** `feat(credits): work out what clips cost and what credits pay for`

---

### Task 4: `CostComparison`, the Now vs New table

**Files:**
- Create: `components/credits/cost-comparison.tsx`, `components/credits/cost-comparison.test.tsx`

**Interfaces:**
- Consumes: `costRows`, `largestIncreasePct`, `coverage`, `describeCoverage`, `RuleLike` (Task 3).
- Produces: `export function CostComparison(props: { now: RuleLike | null; nowLabel: string; next: RuleLike | null; nextLabel: string; adRewardCredits: number | null })`. A table (caption "What clips will cost"; columns Clip, `nowLabel`, `nextLabel`) and, when `largestIncreasePct` is non-null, a warning callout (`role="status"`).

Callout copy (exact): `Clips cost up to {pct}% more.` followed, when `adRewardCredits` is set and the coverage differs, by ` One rewarded ad would pay for {describeCoverage(new)} of captions instead of {describeCoverage(old)}.`

- [ ] **Step 1: Write the failing tests**

```ts
it('lists the six lengths with now and new costs, marking rises', ...)   // row "1 min": cells "4", "6 ↑"
it('marks falls', ...)                                                   // v4 → v3: "1 min" new cell "4 ↓"
it('warns with the largest rise and what an ad pays for', ...)
  // status text: 'Clips cost up to 50% more. One rewarded ad would pay for 30 s of captions instead of 1 min.'
it('shows no warning when nothing costs more', ...)
it('shows "—" for Now when there is no live price, and no warning', ...)
it('shows "—" for New while the draft is invalid', ...)                  // next null
```

- [ ] **Step 2: Run** `npx vitest run components/credits/cost-comparison.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Rises in `text-[#FDBA74]` with "↑", falls in `text-success` with "↓", unchanged in `text-muted`. Clip names via `describeLength`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(credits): a Now vs New table of what clips cost`

---

### Task 5: Change price sheet

**Files:**
- Create: `components/credits/change-price-sheet.tsx`, `components/credits/change-price-sheet.test.tsx`

**Interfaces:**
- Consumes: `ruleToDraft`, `draftToRule`, `draftProblems`, `toNewRule`, `describeLength` (Task 3); `CostComparison` (Task 4); `createPricingRule`, `activatePricingRule` (`lib/api/credits.ts`); `Sheet*`, `Dialog*` from `components/ui`.
- Produces: `export function ChangePriceSheet(props: { open: boolean; onOpenChange: (open: boolean) => void; live: PricingRule | null; startFrom: PricingRule | null; nextVersion: number; adRewardCredits: number | null })`. `startFrom` defaults the draft (falls back to `live`). On success it invalidates `['pricing']` and toasts `Price v{n} is live` or `Price v{n} saved for later`.

Copy (exact):
- Title: `Change the Auto captions price` (`Set the Auto captions price` when `live` is null).
- Subtitle: `Filled in with the live price (v{live}). Saving creates v{next}; past charges never change.`, or `Filled in from v{startFrom}. …` when starting from history, or `Saving creates v{next}.` when empty.
- Options (`aria-pressed`): **By time used** "A price for every block of seconds started." / **By length band** "A set price for clips up to a length." / **Flat per job** "The same price for any clip."
- Sentences: per second `Charge [ ] credits for every [ ] seconds started, and never less than [ ] credits a job.` (the minimum may be empty); bands: one row per band `Up to [ ] seconds → [ ] credits` with remove, then `Anything longer → [ ] credits`, button **Add band**; flat `Charge [ ] credits for every clip.` Each input has an `aria-label` naming its role.
- Reason field label: `Reason (shown in the price history)`.
- Footer: **Cancel**, **Save for later**, **Make v{next} live…**. The last opens a Dialog: title `Make v{next} live?`, body `New caption jobs will cost {describePrice(new)}. Jobs already charged keep their price.`, buttons **Cancel** / **Make live**.
- Closing with changes: Dialog `Discard this price?` with **Keep editing** / **Discard**.

- [ ] **Step 1: Write the failing tests**

```ts
it('starts from the live price', ...)                           // inputs 2, 30, 4; "By time used" pressed
it('starts empty, by time used, when nothing is live', ...)
it('starts from a history version when given one', ...)          // startFrom v2 → two bands 60/5, 180/10, longer 20
it('compares against the live price as the user types', ...)    // change credits to 3 → row "1 min" shows "6 ↑"
it('disables saving and explains while the draft is invalid', ...) // clear credits → both save buttons disabled; problem text visible; New column "—"
it('saves for later without making it live', ...)               // createPricingRule called once with { mode: 'per_second', blockSeconds: 30, blockCredits: 3, minCredits: 4, feature: 'auto_captions' }; activatePricingRule not called
it('makes it live only after the confirm', ...)                 // click "Make v4 live…" → dialog → "Make live" → create then activate('new-id')
it('shows the server\'s problems when it refuses', ...)          // createPricingRule rejects ApiError 422 details.problems ['x'] → 'x' shown
it('asks before discarding edits', ...)                         // edit, press Escape → "Discard this price?"; Keep editing keeps the sheet open
```

- [ ] **Step 2: Run** `npx vitest run components/credits/change-price-sheet.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** SheetContent `side="right"`, `sm:max-w-[560px]` and full width below `sm`. The selected option: `border-[var(--brand-from)] bg-[var(--brand-from)]/10`. Changed inputs get the same border.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(credits): change the price in a side panel that starts from the live price`

---

### Task 6: Make a history version live, with the comparison

**Files:**
- Create: `components/credits/make-live-dialog.tsx`, `components/credits/make-live-dialog.test.tsx`

**Interfaces:**
- Consumes: `CostComparison` (Task 4), `activatePricingRule`, `describePrice`.
- Produces: `export function MakeLiveDialog(props: { rule: PricingRule | null; live: PricingRule | null; adRewardCredits: number | null; onClose: () => void })`. Title `Make v{n} live again?` when `rule.activatedAt` is set, else `Make v{n} live?`. Body: `CostComparison` (nowLabel `Now (v{live})`, nextLabel `v{n}`), then `Jobs already charged keep their price.` Buttons **Cancel** / **Make live**. On success: `setQueryData(['pricing', 'auto_captions'], rules)` and toast `Price v{n} is live`.

- [ ] **Step 1: Write the failing tests**: title wording for both cases; the table is shown; **Make live** calls `activatePricingRule(rule.id)` once; a 409 toasts the server message and closes.
- [ ] **Step 2: Run** `npx vitest run components/credits/make-live-dialog.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(credits): see what an old price would cost before making it live again`

---

### Task 7: Credits › Pricing page

**Files:**
- Create: `app/(dashboard)/credits/pricing/page.tsx`, `components/credits/pricing-page.tsx`, `components/credits/pricing-page.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–6; `fetchPricingRules('auto_captions')`, `fetchCreditSettings()`, `fetchCreditStats(30)` (`lib/api/credits.ts`); `formatDate` (Task 1); `DropdownMenu`.
- Produces: the page at `/credits/pricing`: `CreditsHeader` (title "Pricing", subtitle "What each paid feature costs in the app.", primary action **Change price**, or **Set a price** when nothing is live) and, inside `OwnerOnly what="pricing"`, `PricingPage`.

Content (spec §7.1, exact):
- Live card heading `Auto captions` + pill `Live`; meta `Version {n} · live since {formatDate(activatedAt)} · set by {createdBy.email}` (omit the "set by" part when `createdBy` is missing).
- `describePrice(live)`, then "What a clip costs" with the six `SAMPLE_SECONDS` lengths and `{price} cr`.
- Callout: `One rewarded ad ({adRewardCredits} credits) pays for up to {describeCoverage(coverage(live, adRewardCredits))} of captions. The {signupBonusCredits}-credit sign-up bonus covers {describeCoverage(coverage(live, signupBonusCredits))}.` + link **Change what users earn →** to `/credits/earning`. "pays for up to any length" reads `pays for captions of any length`.
- Footer: `Last 30 days: {spent} credits charged · {granted} refunded for failed jobs` from rows of type `feature_charge` (spent) and `feature_refund` (granted).
- No live price: warning `No price is live, so Auto captions is off in the app.`; no cost grid or callout.
- History table: Version (pill `Live` on the live one), Price (`describePrice`), Reason (`note` or "—"), Made live (`formatDate(activatedAt)` or `Never live`), and a `⋯` menu: `Make live…` / `Make live again…` (not on the live row) → `MakeLiveDialog`; `Start a new price from this` → `ChangePriceSheet` with `startFrom`.
- Skeleton for the first load of each card.

- [ ] **Step 1: Write the failing tests** (mock the three fetchers)

```ts
it('states the live price in words, with who set it and when', ...)  // 'Version 3 · live since 23 Oct 2026 · set by owner@slimshot.dev' (activatedAt '2026-10-23T09:00:00Z')
it('shows what each clip length costs', ...)                         // 15 s → 4 cr … 10 min → 40 cr
it('relates ads and the sign-up bonus to the price', ...)            // 'One rewarded ad (5 credits) pays for up to 1 min of captions. The 100-credit sign-up bonus covers 25 min.'
it('sums the last 30 days of charges and refunds', ...)              // 'Last 30 days: 1,515 credits charged · 32 refunded for failed jobs'
it('warns and offers "Set a price" when nothing is live', ...)
it('lists every version with when it was made live', ...)            // v1 activatedAt null → 'Never live'
it('offers "Make live again…" only for versions live before', ...)
it('starts a new price from a history version', ...)                 // menu item → sheet title 'Change the Auto captions price', subtitle 'Filled in from v2. …'
```

- [ ] **Step 2: Run** `npx vitest run components/credits/pricing-page.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the page and component.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(credits): a Pricing page that says what captions cost in plain words`

---

### Task 8: `SettingCard` and Credits › Earning

**Files:**
- Create: `components/credits/setting-card.tsx`, `components/credits/setting-card.test.tsx`, `components/credits/setting-cards.ts`, `components/credits/earning-page.tsx`, `components/credits/earning-page.test.tsx`, `app/(dashboard)/credits/earning/page.tsx`

**Interfaces:**
- Consumes: `updateCreditSettings`, `fetchCreditSettings`, `fetchPricingRules` (live price for hints); `parseField` and `NumericSettingKey` (`components/settings/credit-settings-form.ts`); `fieldErrors` (`lib/api/field-errors.ts`); `coverage`, `describeCoverage` (Task 3); `formatShortDate` (Task 1); `BalanceCheck`.
- Produces:
  - `export type SentencePart = string | { key: NumericSettingKey; label: string; min: number; max: number }`
  - `export interface HintContext { values: Partial<Record<NumericSettingKey, number>>; live: RuleLike | null }`
  - `export interface SettingCardSpec { id: string; title: string; icon: LucideIcon; sentences: SentencePart[][]; hint?: (ctx: HintContext) => string | null }`
  - `export function SettingCard(props: { spec: SettingCardSpec; settings: CreditSettings; live: RuleLike | null })`
  - `setting-cards.ts`: `EARNING_CARDS: SettingCardSpec[]` (`signup`, `ads`, `referrals`) and `SIGN_IN_CODES_CARD: SettingCardSpec`, with the exact sentences of spec §7.3/§7.4 and the bounds of `UpdateCreditSettingsDto` (as in `CREDIT_FIELD_GROUPS`).
  - Hints: sign-up `≈ {describeCoverage(coverage(live, signup))} of captions at today's price.` (null when `live` is null); ads `Up to {reward × cap} credits a day per user.`

Card behaviour:
- Inline inputs (`inputMode="numeric"`, `aria-label` = the part's `label`). A changed input and the card border use `--brand-from`; header pill `Unsaved`.
- Footer when clean: `Changed {formatShortDate} by {by.email}` from the newest `lastChanged` entry among the card's keys (`Changed {date}` when `by` is null), or `Never changed`; disabled **Save**. When dirty: **Undo** and **Save**.
- **Save** sends only this card's keys whose value differs from `settings`. On success, `setQueryData(['credits', 'settings'], saved)` and toast `Saved. The app uses the new values within 30 seconds.`
- The card's draft survives a new `settings` object: values it hasn't edited follow the new settings; values it has edited stay (review focus 1).
- While dirty, a `beforeunload` listener is registered; it is removed when clean or unmounted.
- 422: `fieldErrors(error)[key]` shown under that input; the card stays dirty.

Earning page: `CreditsHeader` (title "Earning", subtitle "How users get credits. Each card saves on its own."), `OwnerOnly what="earning"`, the three cards (grid of 3 at `lg`, stacked below), then the chart slot (Task 9), then `BalanceCheck`. Skeleton: three card-shaped blocks.

- [ ] **Step 1: Write the failing tests**

```ts
// setting-card.test.tsx
it('reads as a sentence with the current values', ...)          // ads card: inputs 'Credits per ad' = 5, 'Ads per day' = 10
it('saves only the fields this card changed', ...)              // change 5→6 → updateCreditSettings({ adRewardCredits: 6 }) exactly
it('undoes back to the saved values', ...)
it('says when its fields last changed, and by whom', ...)       // lastChanged.adDailyCap {at '2026-10-27T…', by owner} → 'Changed 27 Oct by owner@slimshot.dev'
it('says "Never changed" when none of its fields has', ...)
it('keeps its own edits when other settings change', ...)       // rerender with new settings object (signupBonusCredits changed) → ads input still 6, still dirty
it('shows a refused field\'s message under it and stays dirty', ...) // 422 details → message under 'Credits per ad'; value 6 kept
it('guards leaving while dirty', ...)                           // spy addEventListener('beforeunload') after edit; removed after Undo
// earning-page.test.tsx
it('shows the three earning cards with their hints', ...)       // '≈ 25 min of captions at today\'s price.', 'Up to 50 credits a day per user.'
it('leaves out the captions hint when no price is live', ...)
```

- [ ] **Step 2: Run** `npx vitest run components/credits/setting-card.test.tsx components/credits/earning-page.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(credits): an Earning page where each rule reads as a sentence and saves on its own`

---

### Task 9: Credits-by-source chart on Earning

**Files:**
- Create: `components/credits/credits-by-source.tsx`, `components/credits/credits-by-source.test.tsx`
- Modify: `components/credits/earning-page.tsx`

**Before writing it, load the `dataviz` skill** and follow it for colour, marks and the accessible summary.

**Interfaces:**
- Consumes: `fetchCreditStats(30)`, `creditDays` (`lib/api/credits.ts`).
- Produces: `export function CreditsBySource()`: card "Last 30 days", "Credits given to users, by where they came from.", stacked daily bars for **Ads** (`rewarded_ad`), **Sign-up** (`signup_bonus`), **Referrals** (`referral_inviter` + `referral_invitee`), a legend with each 30-day total, and an accessible text summary.

- [ ] **Step 1: Write the failing tests**: legend totals from a fixture (`Ads 910`, `Sign-up 2,300`, `Referrals 325`); a day with no rows renders an empty column (30 columns always); the summary text names all three totals.
- [ ] **Step 2: Run** `npx vitest run components/credits/credits-by-source.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** and place it between the cards and `BalanceCheck`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(credits): where users' credits came from, day by day`

---

### Task 10: System › Sign-in security

**Files:**
- Create: `components/security/blocked-domains-card.tsx`, `components/security/blocked-domains-card.test.tsx`, `components/security/security-page.tsx`, `app/(dashboard)/system/security/page.tsx`
- Modify: `lib/use-toast.ts`, `components/ui/toast.tsx` (+ their tests)

**Interfaces:**
- Consumes: `SettingCard`, `SIGN_IN_CODES_CARD` (Task 8); `normalizeDomains` (`credit-settings-form.ts`); `updateCreditSettings`; `SystemHeader` (Task 2).
- Produces:
  - `toast(message, variant?, action?: { label: string; onClick: () => void })`, rendered as a button in the toast.
  - `export function isBlockableDomain(text: string): boolean`: a lowercase hostname with at least one dot, labels 1–63 chars of `a-z0-9-` not starting or ending with `-`, TLD letters only.
  - `export function BlockedDomainsCard({ settings }: { settings: CreditSettings })`.
  - Page `/system/security`: `SystemHeader title="Sign-in security" subtitle="Limits on email sign-in codes, to stop abuse."`, `OwnerOnly what="sign-in security"`, two cards side by side at `lg`.

Domains card (exact copy): heading `Blocked email domains`, description `Email sign-in is refused for these throwaway-mail services.`, count `{n} domains`, input placeholder `Add a domain, e.g. tempmail.com`, button **Add**, chips with a remove button `aria-label="Remove {domain}"`. Errors: `Enter a domain like tempmail.com` / `{domain} is already blocked`. Each add or remove sends `{ disposableEmailDomains: fullList }` and on success toasts `Blocked {domain}` / `Unblocked {domain}` with action **Undo** (sends the list as it was). A search box (`Search domains`) appears when there are more than 20.

- [ ] **Step 1: Write the failing tests**

```ts
it('adds a domain, normalised, and saves the whole list', ...)   // ' TempMail.com ' → updateCreditSettings({ disposableEmailDomains: [...old, 'tempmail.com'] })
it('refuses a duplicate or a non-domain without saving', ...)
it('removes a domain and offers Undo', ...)                       // remove → list without it; toast action Undo → list restored
it('shows a search box only past 20 domains', ...)
// toast test: an action renders a button that calls onClick
```

- [ ] **Step 2: Run** `npx vitest run components/security lib/use-toast components/ui/toast`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(security): sign-in limits and blocked domains get their own System page`

---

### Task 11: Switch the navigation and retire the old Credits page

**Files:**
- Modify: `components/shell/nav-items.ts`, `components/shell/nav-items.test.ts`, `next.config.ts`
- Create: `next.config.test.ts`
- Delete: `app/(dashboard)/system/credits/page.tsx`, `components/settings/credits-tab.tsx`, `components/settings/credits-tab.test.tsx`, `components/settings/pricing-tab.tsx`, `components/settings/pricing-tab.test.tsx`, `components/settings/price-dialog.tsx`, `components/settings/price-dialog.test.tsx`; remove `CREDIT_FIELD_GROUPS` from `credit-settings-form.ts` if nothing imports it any more (keep `normalizeDomains`, `parseField`, `NumericSettingKey`).

**Interfaces:**
- Produces:
  - `navGroups` for an owner: `[Overview] · Library · People [/users] · Credits [/credits/pricing "Pricing" (Tag), /credits/earning "Earning" (Gift)] · System [/system/providers, /system/security "Sign-in security" (ShieldCheck), /system/audit]`. For anyone else: no Credits group; System `[/system/audit]`.
  - `mobileSections`: owner `Overview /, Library /audio, Users /users, Credits /credits/pricing (match ['/credits']), System /system/providers`; others `Overview, Library, Users, System /system/audit`.
  - Redirect `{ source: '/system/credits', destination: '/credits/pricing', permanent: false }`.

- [ ] **Step 1: Update the failing tests** in `nav-items.test.ts` for the shapes above, and add `next.config.test.ts`: `(await nextConfig.redirects!()).find(r => r.source === '/system/credits')?.destination === '/credits/pricing'`.
- [ ] **Step 2: Run** `npx vitest run components/shell next.config.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, then delete the retired files and fix any remaining imports.
- [ ] **Step 4: Run** `npm test && npm run lint && npx tsc --noEmit`. Expected: all green; no test references the deleted files.
- [ ] **Step 5: Commit** `feat: Credits gets its own place in the sidebar; old Credits page redirects`

---

### Task 12: Verify in the browser

Done by the controller, not a subagent.

- [ ] **Step 1:** `npm run build`. Expected: exit 0.
- [ ] **Step 2:** Run the dev server and the stand-in API harness (updated with `createdBy`, `lastChanged`) and screenshot, at 1440×900 and 390×844: `/credits/pricing`, the Change price sheet (clean and with credits 2→3), the Make live dialog, `/credits/earning` (clean and with one card dirty), `/system/security`, `/system/providers`, `/system/audit`, and `/system/credits` (must land on `/credits/pricing`).
- [ ] **Step 3:** Capture console errors on every page above. Expected: no hydration error, no React key warnings.
- [ ] **Step 4:** Compare each screenshot with mockup screens 1–4 and list any differences for the owner.
