# Credits admin — Design

**Status:** approved in conversation on 2026-10-05; this document records it.
**Builds on:** `docs/design-spec.md` (design system, responsive rules, auth, error handling),
which stays the authority for everything this document does not change.
**API:** `../slimshot_server/docs/admin-credits-api.md` (branch `feat/accounts-credits`). Where
this document and that file disagree on a request or response shape, that file wins.

## 1. Purpose

The mobile app now has accounts and a credit economy: a signup bonus, referrals, rewarded ads,
and paid Auto captions. The owner needs to run that economy from the dashboard: find and inspect
app users, correct balances, suspend or delete accounts, set the amounts and limits, publish
caption prices, and see credits flowing in and out.

**Success:** every route in `admin-credits-api.md` is usable from the dashboard by the roles it
allows, with no step that needs the database or a terminal.

## 2. Roles

The server enforces permissions; the dashboard hides what a role cannot use, so nobody is shown
a button that can only fail.

| Role | Sees | Can do |
|---|---|---|
| viewer, editor | Users list and detail, credit history, Overview credits chart | nothing on users |
| admin | the same | adjust credits, suspend, unsuspend, delete users |
| owner | everything, plus Settings → Credits and Pricing | all of the above, plus settings, prices, balance check |

`lib/auth/permissions.ts` holds the two rules the UI needs: `canManageUsers(role)` is true for
`admin` and `owner`; `canManageCredits(role)` is true for `owner` only.

## 3. Navigation

Five peers on the desktop sidebar and the phone bottom bar, in this order: **Overview, Assets,
Users, Categories, Audit log**. Users uses Lucide's `Users` icon. Settings keeps its place at
the sidebar foot and as the gear in the phone top bar.

## 4. Users list — `/users`

- A debounced search box (reuse `DebouncedSearchInput`) matching any part of the email or
  username. The term lives in the URL as `?q=` so a search survives reload and the back button.
- **Desktop (`md` and up):** a table with columns User (username, or *Not claimed yet* in
  muted text, with the email beneath), Status (pill: active / suspended / deleted), Balance
  (right-aligned, grouped digits), Joined (date).
- **Below `md`:** a card list carrying the same fields — a different component, not a squeezed
  table, as for Assets.
- A row or card opens `/users/{id}`.
- Paging with **Load more** (`useInfiniteQuery`, 20 per page). The server returns
  `{ items, nextCursor }` inside `data`.
- Empty states: *No app users yet* with no search; *No users match "ann"* with one.
- A deleted user shows `—` for the email it no longer has.

## 5. User detail — `/users/{id}`

### 5.1 Header

Back link to the list (keeping the search). Username (or *Not claimed yet*), email, status
pill, the balance as the largest figure on the page, joined date, claimed date, referral code,
sign-in method chips (*Google*, *Email*), and *Deleted on …* for a deleted account. An unknown
id shows *This user does not exist* with a link back.

### 5.2 Credit history

Newest first, **Load more** as in the list. Each row: a plain label, the signed amount
(credits added in `--success`, credits taken in the default text colour, always with a `+` or
`−`), the balance after it, and the date and time.

| `type` | Label |
|---|---|
| `signup_bonus` | Signup bonus |
| `referral_inviter` | Referral reward (invited someone) |
| `referral_invitee` | Referral bonus (was invited) |
| `rewarded_ad` | Rewarded ad |
| `feature_charge` | Auto caption |
| `feature_refund` | Auto caption refund |
| `admin_adjustment` | Adjustment by an admin |
| `account_deleted` | Forfeited on deletion |
| `purchase` | Purchase |

An unknown type shows its code, so a new server type is visible before the dashboard learns it.

### 5.3 Actions

Shown only when `canManageUsers(role)`, and never on a deleted account. Each is a dialog (the
existing shadcn `Dialog`, which follows the responsive modal rule). Every success shows a toast
and invalidates the user's detail, history and the list.

- **Adjust credits.** An *Add* / *Remove* choice, a whole-number amount (1–1,000,000) and a
  reason (3–500 characters). A live line reads *New balance: 112*. The request sends the amount
  signed (`Remove 20` → `amount: -20`). The server's below-zero refusal (`422`, message *This
  would take the balance below zero.*, `details.balance`) is shown inline under the amount with
  the current balance, and the dialog stays open.
- **Suspend.** A reason (3–500) and one sentence on what it does: *They stay signed in but
  can't spend credits, earn from ads or claim a bonus.* Shown for active users.
- **Unsuspend.** A plain confirm. Shown for suspended users.
- **Delete user.** A reason (3–500), the warning *This can't be undone. Their personal data is
  erased and their N credits are forfeited.*, and a field asking for the user's email; the red
  **Delete** button stays disabled until it matches, ignoring case and surrounding spaces. A
  user without an email confirms with their username instead, and one with neither with their
  id. On success the page shows the user as deleted.

A `404` or `409` from any action shows the server's message in a toast and refetches the user,
since it means someone else changed it first.

## 6. Settings → Credits tab (owner)

Settings gains two tabs after Providers: **Credits** and **Pricing**. Both mount only for the
owner, like Providers, so no other role fires their queries.

### 6.1 Amounts and limits

One form, in four groups, each field a number input with the server's bounds as `min`/`max`:

| Group | Fields (label — API field — bounds) |
|---|---|
| Rewards | Signup bonus — `signupBonusCredits` 0–100000; Credits per rewarded ad — `adRewardCredits` 0–100000; Rewarded ads per day — `adDailyCap` 0–1000 |
| Referrals | Inviter gets — `referralInviterCredits` 0–100000; Invited person gets — `referralInviteeCredits` 0–100000; Rewarded referrals per inviter — `referralCapCount` 0–10000; …within days — `referralCapDays` 1–365 |
| Abuse limits | New accounts per IP per 24 h — `ipSignupLimitPer24h` 1–100000; Wrong code attempts — `otpMaxAttempts` 1–20; Wait between codes (s) — `otpResendCooldownSeconds` 0–3600; Codes per email per hour — `otpPerEmailPerHour` 1–10000; per install — `otpPerDevicePerHour` 1–10000; per IP — `otpPerIpPerHour` 1–10000 |
| Disposable email domains | a textarea, one domain per line, with *N domains* beneath |

- **Save** is enabled only when something changed, and sends only the changed fields in the
  `PUT`. Domains are trimmed, lowercased, de-duplicated and blank lines dropped before
  comparing and sending.
- A `422` maps onto the offending fields through `fieldErrors`; anything it cannot map shows as
  a summary above the button.
- Beneath the form: *Last changed {date}*. The server applies changes within 30 seconds; the
  form says so after a save.

### 6.2 Balance check

A card under the form: **Check balances** runs `GET /credits/reconciliation`. Result:
*Every balance matches its history* (success tone), or a list of mismatched users, each linked
to their page, with *stored N · history M*. The card explains that the server also runs this
check daily and never corrects a mismatch by itself.

## 7. Settings → Pricing tab (owner)

Feature: `auto_captions`, the only one today.

- **Current price card.** The active version as one line: *v3 · up to 1 min → 2 credits ·
  up to 5 min → 5 · longer → 10*, or *v2 · 3 credits per job*. With no active version, a
  warning: *No price is active, so Auto caption is switched off in the app.*
- **Version history**, newest first: version, the same one-line summary, the note, created
  date; the active one carries an *Active* badge, the others an **Activate** button behind a
  confirm: *New caption jobs will be charged at v4. Jobs already charged keep their price.*
- **New price** opens a dialog:
  - Mode: *Per job* or *By length*.
  - Per job: one credits field (0–100000).
  - By length: rows *Up to [seconds] → [credits]*, an **Add tier** button (up to 50 tiers),
    a remove control per row, and a fixed last row *Anything longer → [credits]* that sends
    `upToSeconds: null`. Each seconds field shows a readable length beside it (*90 s =
    1 min 30 s*).
  - Note (optional, ≤ 500 characters).
  - **Activate now**, ticked by default: creates, then activates.
  - Checked before sending, mirroring the server: whole numbers; seconds 1–86400 and each
    larger than the tier before; credits 0–100000. The server's `details.problems` sentences
    are shown as a list if it still refuses.
- Rules are never edited: a price change is a new version, which the tab says in one line.

## 8. Overview → Credits panel (every role)

A full-width panel below the uploads row, using the waveform style of `UploadWaveform`.

- Data: `GET /stats/credits?days=30`, zero-filled to 30 days ending today (UTC).
- Each day is one column centred on a baseline: credits **granted** (all types summed) rise
  above it, credits **spent** fall below it, both on one shared scale so their heights compare.
- Hover, focus and the arrow keys move a playhead, as in the uploads chart, showing the day,
  *granted N · spent M*, and the per-type figures for that day with the history labels from
  §5.2.
- Beside the chart: totals for the 30 days, *Granted* and *Spent*.
- Loading keeps the existing skeleton approach; a refetch dims the last render.

## 9. Audit log

`lib/activity-copy.ts` learns the new actions:

| Action | Text | Tone |
|---|---|---|
| `credits.adjusted` | Adjusted a user's credits | default |
| `user.suspended` | Suspended a user | default |
| `user.unsuspended` | Lifted a user's suspension | default |
| `user.deleted` | Deleted a user | default |
| `pricing.rule.created` | Created a caption price | default |
| `pricing.rule.activated` | Activated a caption price | default |
| `credits.settings.updated` | Changed the credit settings | default |
| `credits.reconcile.mismatch` | Found a balance that doesn't match its history | error |

An audit entry whose `entityType` is `User` links to `/users/{entityId}`.

## 10. Code layout

- `lib/api/users.ts` — search, detail, ledger, adjust, suspend, unsuspend, remove.
- `lib/api/credits.ts` — settings get/put, pricing list/create/activate, reconciliation,
  credit stats, plus the shared types and the history labels.
- `lib/auth/permissions.ts` — the two role rules.
- `components/users/` — list content, table, card, detail header, history list, and one file
  per dialog.
- `components/settings/credits-tab.tsx`, `balance-check.tsx`, `pricing-tab.tsx`,
  `price-dialog.tsx` (with the tier editor), and a pure `pricing-format.ts` for the one-line
  summaries and readable lengths.
- `components/overview/credits-waveform.tsx`.
- `app/(dashboard)/users/page.tsx` and `app/(dashboard)/users/[id]/page.tsx`.

Query keys: `['users', 'list', q]`, `['users', 'detail', id]`, `['users', 'ledger', id]`,
`['credits', 'settings']`, `['pricing', feature]`, `['stats', 'credits', 30]`. The balance
check is a mutation-style manual fetch, never on mount.

## 11. Errors

As in `design-spec.md` §9: the server's `message` in a toast, `traceId` to the console, `422`
details onto fields, `401` after a failed refresh back to login. The specific cases above
(below-zero adjustment, pricing problems, 404/409 on user actions) are handled where they occur.

## 12. Testing

Vitest + Testing Library, test-first, alongside the code:

- API modules: each function's path, method and body (including the signed adjustment amount
  and `upToSeconds: null` on the last tier).
- `permissions.ts`: each role against both rules.
- Users list: a table at `md` and up, cards below; the search writes `?q=`.
- Detail: actions hidden for viewer and editor and on a deleted user; history labels and signs.
- Adjust dialog: Remove sends a negative amount; the below-zero 422 shows the balance inline.
- Delete dialog: the button stays disabled until the email matches (case- and space-insensitive).
- Credits tab: only changed fields are sent; domains normalised.
- Pricing: tier checks block bad input; the payload's shape; create-then-activate when ticked;
  the no-active-price warning.
- Credits chart: granted above, spent below, zero-filled days.
- Activity copy: every new action has its sentence.

## 13. Not in this build

Editing a user's username, viewing a user's devices or sessions, exporting users, purchases,
and pricing for features other than Auto caption.
