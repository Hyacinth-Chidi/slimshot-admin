# Admin layout redesign: design

Date: 2026-10-29. Repos: `slimshot-admin` (most of the work), `slimshot_server` (small, additive
read-side additions). Source: a review of the running dashboard (every page screenshotted on
desktop and phone against stand-in data), the findings report, and a clickable mockup the owner
approved without changes. The mockup is kept at
`../.superpowers/brainstorm/1155-1793265268/content/admin-redesign-v2.html` (workspace root).
Where this document and the mockup differ, this document wins; each difference is listed in §11.

## 1. Why

The dashboard's parts are sound (dark theme, skeletons, shadcn primitives, real tables). What
reads as unprofessional is the arrangement:

- The most important business setting, what Auto captions costs, sits three navigation levels
  deep (sidebar › System tabs › Rules/Pricing tabs) and reads like code ("v3 · 2 credits per
  30 s · at least 4 credits").
- Changing a price starts from a blank form, in a different mode from the live one, with a
  preview in only one of three modes and "Activate now" switched on by default.
- Credit rules are 13 bare number boxes with no units, one Save at the very bottom, and
  sign-in security limits mixed in with credits.
- Pages repeat themselves (the name three times on a detail page, System tabs repeating the
  sidebar), put the main action in a different place on each page, and format dates three ways.
- The Overview counts library items only, with a Processing tile that cannot move.
- The Audit log page has a hydration error.

## 2. Goals

1. Credits get their own sidebar group with two pages, **Pricing** and **Rewards**, each readable
   at a glance by someone who did not build the system.
2. Changing a price starts from the live price, shows exactly what changes before anything is
   saved, and makes "goes live" a deliberate, confirmed step.
3. Settings read as sentences with units; each group saves on its own.
4. Sign-in security limits live under System, not Credits.
5. One page header everywhere; detail pages use one two-column pattern.
6. Lists show what the owner needs (category, downloads, readable short durations) and drop
   what never changes or never happens.
7. The Overview leads with the business (users, credits) and says what needs attention.
8. One date format, plain wording, no hydration errors.

## 3. Non-goals and anti-goals

**Not in this work:** a light theme; new features (payments, new asset kinds, new user data);
any change to `/api/app/v1/*` or the Flutter app; any change to how prices, charges, grants or
refunds are calculated; server-drawn waveforms; per-field change history for credit settings.

**Anti-goals (failure even if it "works"):**

- A save that sends fields the person didn't touch. Each Rewards or Sign-in security card sends
  **only its own changed fields** (the server's `PUT /credit-settings` accepts a partial body), so
  two people editing different cards can't overwrite each other.
- A price going live without the person seeing what it does to real clip lengths first.
- Unsaved edits lost silently on navigation.
- An old URL that now 404s. Every moved page redirects.
- A hydration error on any page.
- Brand gradient used anywhere beyond its four places (primary button, active nav indicator,
  focus rings, logo mark).

## 4. Constraints

- Next.js 16 (`proxy.ts`, async `cookies()`), Tailwind v4 (`@theme inline`), React 19, TanStack
  Query v5. **Use Context7 for framework docs before writing framework code**, and tell any
  subagent to do the same.
- UI primitives come from shadcn/ui (Radix), restyled to the dark tokens: Sheet, Dialog,
  DropdownMenu, Select, Switch, Tabs, Tooltip. Never hand-rolled.
- Every first-load state is a content-shaped skeleton, never "Loading…".
- Dark only. Tokens in `app/globals.css`. Plus Jakarta Sans.
- Test-first: Vitest + Testing Library (admin), Jest (server). Server additions must keep
  `npm run typecheck`, `npm run lint` and `npm test` green.
- Owner-only areas stay owner-only in the UI (the server enforces it regardless):
  Credits › Pricing, Credits › Rewards, System › AI providers and System › Sign-in security
  need `credits.manage` / `providers.manage`, which only the owner has.
- Commits: conventional, plain-English, one `Co-Authored-By` trailer.

## 5. Navigation and routes

Sidebar (desktop):

| Group | Items |
|---|---|
| — | Overview |
| Library | Audio, Fonts |
| People | Users |
| Credits (owner only) | Pricing, Rewards |
| System | AI providers (owner), Sign-in security (owner), Audit log |

Routes and redirects (redirects in `next.config.ts`, query strings carried over, not permanent):

| New route | Replaces |
|---|---|
| `/credits/pricing` | `/system/credits` (Pricing tab) |
| `/credits/rewards` | `/system/credits` (Rules tab, credit fields) |
| `/system/security` | `/system/credits` (Rules tab, sign-in fields and domains) |

`/system/credits` redirects to `/credits/pricing`. Existing redirects stay.

**Naming (owner, 2026-10-29):** the page of free credits users get is **Rewards**, not
"Earning". "Earnings" is kept for the owner's revenue, once payments exist; it will be its own
page then.

**Section tabs** that repeat sidebar items (Credits: Pricing | Rewards; System: AI providers |
Sign-in security | Audit log) show **on phones only** (`md:hidden`), where there is no sidebar.
Tabs that lead to pages the sidebar doesn't list stay visible at every size: Audio's Sounds |
Categories and Fonts' Fonts | Order.

The phone bottom bar becomes five items: Overview, Library, Users, Credits (owner only), System.

**Hydration bug.** `SystemHeader` renders role-dependent tabs. The page's Suspense boundary
hydrates after the profile query has resolved, so the client renders tabs the server didn't.
Requirement: anything that depends on the profile renders identically on the server and on the
first client render (e.g. render it only after mount, or keep the same markup and change only
content). A test must fail with the current code and pass with the fix.

## 6. Shared page pattern

`PageHeader` (exists in `components/shell/page-header.tsx`) grows:

- an optional **status pill** beside the title,
- an optional **subtitle** line,
- **actions** on the right: one primary action at most, secondary actions, and a `⋯`
  DropdownMenu for rare or destructive ones.

Every page uses it. Detail pages drop their "Back to…" link; the breadcrumb links back.
The User page adopts it (People › Users › *username*).

**Detail page layout** (lg and up): main column (preview/player, then one form with one Save)
and a 340px side column (About facts, then any media card, then a red-bordered **Delete** card).
Below lg, the side column stacks under the main one.

**One form, one Save.** A detail page's editable fields form one card with one footer: "Unsaved
changes" on the left when dirty, **Discard** and **Save** on the right. Leaving with unsaved
changes asks first (in-app navigation and `beforeunload`).

## 7. Screens

### 7.1 Credits › Pricing (`/credits/pricing`)

Header: crumbs "Credits", title "Pricing", subtitle "What each paid feature costs in the app",
primary action **Change price**.

**Live price card** ("Auto captions", pill "Live"):

- Line: "Version 3 · live since 23 Oct 2026 · set by owner@slimshot.dev" (`activatedAt`,
  `createdBy.email`, see §9).
- The price as one plain sentence, e.g. "2 credits for every 30 seconds started · never less
  than 4 credits" (per second); "5 credits up to 1 min · 10 up to 3 min · 20 for anything
  longer" (bands); "10 credits per clip, any length" (flat).
- **What a clip costs**: 15 s, 30 s, 1 min, 3 min, 5 min, 10 min, computed client-side with the
  existing pricing helpers (`components/settings/pricing-format.ts`), never re-implemented.
- **Callout**: what one rewarded ad (`adRewardCredits`) and the sign-up bonus
  (`signupBonusCredits`) pay for at this price, e.g. "One rewarded ad (5 credits) pays for up to
  1 min of captions. The 100-credit sign-up bonus covers 25 min." with a link to Rewards. "Pays
  for up to X" is the longest clip whose cost ≤ the credits.
- Footer: "Last 30 days: 1,515 credits charged · 32 refunded for failed jobs" from
  `GET /stats/credits?days=30` (`feature_charge` spent, `feature_refund` granted).
- No price live: the card says so in warning colour ("No price is live, so Auto captions is off
  in the app") and the primary action reads **Set a price**.

**Price history card**: a table, newest version first. Columns: Version (with "Live" pill),
Price (short form), Reason (`note`), Made live (`activatedAt` date, or "Never live"), and a `⋯`
menu with **Make live…** ("Make live again…" for a version that has been live before) and **Start
a new price from this** (opens Change price filled from that version). Making a version live from
here opens a confirm Dialog with the same **Now vs New** table and price-rise callout as the
Change price sheet (§7.2), one shared component, so no price goes live unseen. A version's `activatedAt` is overwritten when it
is made live again, so the column shows the latest date, not a range.

### 7.2 Change price (Sheet over Pricing)

A shadcn **Sheet** from the right, 560px on desktop, full width on phones.

- Title "Change the Auto captions price"; subtitle "Filled in with the live price (v3). Saving
  creates v4; past charges never change." (or "…filled in from v2" when started from history).
- **How to charge**: three large options, each with a one-line explanation, the chosen one
  clearly marked (border + tint, `aria-pressed`):
  - **By time used** (`per_second`): "A price for every block of seconds started."
  - **By length band** (`duration_tiers`): "A set price for clips up to a length."
  - **Flat per job** (`per_job`): "The same price for any clip."
- Fields read as a sentence. Per second: "Charge [2] credits for every [30] seconds started, and
  never less than [4] credits a job." Bands: one row per band ("Up to [60] seconds → [5]
  credits"), "Anything longer → [20] credits", Add band / remove band. Flat: "Charge [10]
  credits for every clip." Changed inputs are highlighted.
- **What clips will cost**: a Now vs New table for the six lengths, in every mode; increases
  marked "↑" in orange, decreases "↓" in green.
- **Callout** when any length gets dearer: the largest increase as a percentage, and what one
  rewarded ad would now pay for versus today. Shown in warning colour.
- **Reason** field (`note`, optional, max 500), labelled "Reason (shown in the price history)".
- Footer: **Cancel**, **Save for later** (creates the version, not live), **Make v4 live…**
  (primary). The last opens a confirm Dialog summarising the change ("New caption jobs will cost
  … Jobs already charged keep their price.") and then creates and activates.
- Validation as today (`draftProblems`); server 422 `details.problems` shown in the sheet.
  Closing the sheet with edits asks first.

### 7.3 Credits › Rewards (`/credits/rewards`)

Header: crumbs "Credits", title "Rewards", subtitle "Free credits users get from the sign-up
bonus, ads and referrals. Each card saves on its own." Each card's footer says when one of **its** fields last changed and by whom ("Changed 27
Oct by owner@slimshot.dev"), from `lastChanged` (§9); a card whose fields never changed says
"Never changed".

Three cards in a row (stacked on phones), each a sentence with inline number inputs:

- **Sign-up bonus**: "New accounts get [100] credits when they pick a username." Hint: "≈ 25 min
  of captions at today's price." Then "Only the first [3] new accounts from one network in 24
  hours get the bonus." (`signupBonusCredits`, `ipSignupLimitPer24h`; accounts past the limit
  are still created, they just get no bonus.)
- **Rewarded ads**: "Each ad watched gives [5] credits, up to [10] ads per user a day." Hint:
  "Up to 50 credits a day per user." (`adRewardCredits`, `adDailyCap`.)
- **Referrals**: "When a friend joins with a code, the inviter gets [20] and the friend gets [20]
  credits. Each inviter is rewarded for up to [10] friends every [30] days."
  (`referralInviterCredits`, `referralInviteeCredits`, `referralCapCount`, `referralCapDays`.)

Each card: footer with **Undo** and **Save** when dirty (card border tinted, "Unsaved" pill),
disabled Save otherwise. Save sends only that card's changed fields. Field errors (422) show under
the input; limits mirror the server DTO.

Below the cards: **Last 30 days** chart of credits given by source (ads, sign-up, referrals), from
`GET /stats/credits?days=30` (load the `dataviz` skill before building it). At the bottom: the
existing **Balance check** card.

### 7.4 System › Sign-in security (`/system/security`)

Header: crumbs "System", title "Sign-in security", subtitle "Limits on email sign-in codes, to stop
abuse."

- **Sign-in codes** card (footer "Changed … by …" as on Rewards): "A code allows [5] wrong tries. Users wait [60] seconds before asking for
  another." and "Each hour, at most [5] codes per email, [10] per phone and [20] per network."
  (`otpMaxAttempts`, `otpResendCooldownSeconds`, `otpPerEmailPerHour`, `otpPerDevicePerHour`,
  `otpPerIpPerHour`.) Same per-card save as Rewards.
- **Blocked email domains** card: "Email sign-in is refused for these throwaway-mail services."
  An input + **Add**, then the domains as removable chips, with a count. Each add or remove saves
  at once (sends the whole `disposableEmailDomains` list) and toasts with **Undo**. Domains are
  normalised and checked with the existing helpers; duplicates and invalid entries are refused
  inline. A search box appears above the chips when there are more than 20.

### 7.5 Sound page (`/audio/[id]`)

Header: crumbs Library › Audio, title, status pill; actions **Publish/Unpublish** and `⋯` (Copy
ID, Delete…).

Main column:
- **Player card**: cover (72px), play/pause button, a progress bar with elapsed and total time,
  length. Merge the unmerged `feat/sound-player` branch first and build on its player.
- **Details card**: Title, Category (Select showing the full path, hint "Shown under the *UI* pill
  in the app"; "No category — won't show in the app" when empty), Author. One Save.

Side column: **About** (Downloads, Length, File format · size, Published, Uploaded, ID with copy),
**Cover** (Replace / Remove, existing cover logic), **Delete sound** card (existing dialog).

### 7.6 Font page (`/fonts/[id]`)

Same pattern. Main: large preview tile, then one **Details** card with Display name and Licence
and one Save (today they are two forms). Header actions: Publish/Unpublish, **Upload new
version**, `⋯` (Download file, Copy ID, Delete…). Side: About (Family, Style, Version, Format,
Size, Downloads, Published), Delete card.

### 7.7 User page (`/users/[id]`)

Header: crumbs People › Users, title username (or "Not claimed yet"), status pill; actions
**Adjust credits**, **Suspend/Unsuspend**, `⋯` (Delete user…). Main: Credit history. Side: a
Balance card (large number) and About (Email, Sign-in methods, Joined, Claimed, Referral code).

### 7.8 Lists

- **Audio**: columns Sound (cover with a play overlay; on phones a second line "Category · length"),
  Category (full path), Length, Downloads, Status, Added. The Author column goes. Status chips
  show counts per status for this kind (§9); a chip with a zero count for a status that can't
  currently occur (Processing) is hidden.
- **Fonts**: larger preview (about 160×48), Display name, Family · style, Version, Downloads,
  Status, Added. Chips with counts.
- **Durations**: under 10 s show one decimal ("0.4 s", "2.3 s"); 10 s and over show `m:ss`.
  Missing shows "—".
- **Categories** tab: **New category** moves into the page header actions; each switch gets a
  visible label ("In the app").
- **Audit log**: actor shown as email; entity shown as its label ("UI Button Click", "v3",
  "amaka_edits") linking to its page where one exists. Filters: **Action** (Select, grouped,
  plain names), **Type** (Select), **Who** (Anyone / Only me). Free-text id boxes go.
- **Users**: unchanged apart from the shared formats.

### 7.9 Overview (`/`)

Header: title, subtitle with today's date, a range Select (7 / 30 / 90 days) driving every number
and chart on the page.

- **KPI row**: Users (total; "+86 in 7 days"), Credits spent on captions (period; "N refunded"),
  Credits given (period; "N from ads"), Library (total; "10 sounds · 5 fonts · 13 live").
- **Definitions**, shared by the KPI cards and the chart so their numbers agree:
  - *Given* = sign-up bonus + both referral grants + rewarded ads + positive admin adjustments +
    purchases.
  - *Spent on captions* = caption charges minus caption refunds (net).
  - Admin deductions and credits forfeited on account deletion are in neither (they show in a
    user's history and the audit log).
  The existing credits chart's sums change to these definitions.
- **Needs attention** callout, hidden when there is nothing to do. It counts, per kind,
  **failed** uploads and uploads **ready but not live** (`ready`; this includes anything
  unpublished on purpose, which the wording covers). It never counts `draft`, which is an upload
  that was started and never finished. Each count is its own link to the matching filtered list,
  e.g. "**1 failed sound** · **3 fonts ready but not live**".
- **Credits** chart (given vs spent per day) beside **Recent activity**.
- **Recent activity**: plain English for every audit action the server writes, naming the actor
  and the item ("Owner published UI Button Click", "Owner gave amaka_edits 22 credits", "Owner
  uploaded version 3 of Oswald"), with an icon per area and relative time. Unknown actions fall
  back to a readable form of the code, never the raw dotted string.
- The uploads chart and the Processing tile are removed.

### 7.10 Consistency

- **Dates** through one module (`lib/format.ts`): "29 Oct 2026"; with time "29 Oct 2026,
  14:05"; relative "2h", "1d" in feeds. `en-GB` everywhere. Numbers `en-GB` grouping.
- **Wording**: plain English for the owner. Replace the upload dialog's "Each file gets its own
  ticket, upload and finalize…" with "Files upload one by one; if one fails, the rest carry on."
  No "upper bound", "ticket", "finalize" or similar in the UI.

## 8. Phases

Each phase ends green (tests, typecheck, lint) and with desktop + phone screenshots of every
changed page for the owner.

0. **Server additions** (§9).
1. **Credits**: navigation and routes, Pricing, Change price, Rewards, Sign-in security, the
   hydration fix.
2. **Page pattern**: `PageHeader` additions, Sound, Font and User pages (merge `feat/sound-player`).
3. **Lists and consistency**: list columns and chips, durations, Audit log, Categories, dates,
   wording.
4. **Overview**.

## 9. Server additions (`slimshot_server`, additive, no migrations)

All admin-only reads; nothing app-facing changes. Each with specs.

| Endpoint | Addition |
|---|---|
| `GET /pricing-rules` (and the lists returned by create/activate) | each rule gets `createdBy: { id, email, name } \| null` |
| `GET` and `PUT /credit-settings` | `lastChanged: { [field]: { at, by: { id, email, name } \| null } }` for every editable field, worked out from the `credits.settings.updated` audit entries (each stores the full row before and after). Newest first, stopping once every field is resolved, scanning at most 1,000 entries; a field not found gets no key |
| `GET /audit-logs` | each entry gets `actor: { id, email, name } \| null`, `entityLabel: string \| null` (Asset title, User username or email, Category name, PricingRule "v3", provider name, admin email) and `entityDeleted: boolean` |
| `GET /stats/summary` | `byKindStatus: { [kind]: { [status]: number } }` |
| new `GET /stats/users?days=` (`users.read`) | `{ total, newInPeriod }` (deleted accounts excluded) |

Labels are resolved in batches per entity type (no query per row). A deleted sound or font
keeps its row, so it keeps its title, and the entry also gets `entityDeleted: true`; the UI shows
the title with no link ("Owner deleted UI Button Click"). Things removed outright or scrubbed
(deleted categories, deleted users) give `entityLabel: null`; the UI shows the kind ("a
category", "a deleted user").

## 10. Left to the builder

Component structure and file names; how unsaved-change guards are wired; exact spacing within the
tokens; chart internals (within the `dataviz` skill); how the hydration fix is implemented as long
as §5's requirement and test hold; test layout.

## 11. Differences from the approved mockup (calls made while writing this)

1. **Price history "Live" ranges** became one "Made live" date: re-activating a version
   overwrites its `activatedAt`, so ranges would be wrong.
2. **The sound player has a progress bar, not a waveform**: no waveform data exists, and drawing
   one in the browser depends on CDN CORS settings.
3. **Status chip counts** need the `byKindStatus` server addition (§9); the mockup assumed it.
4. **Audit "Who" filter** is Anyone / Only me: there is no list of admins to choose from.
5. **Overview "Needs attention"** says "ready but not live" rather than "drafts": on the server a
   draft is an unfinished upload, not something waiting to be published.
6. **The Overview's uploads chart** is gone, as in the mockup; the credits chart's totals now use
   the same definitions as the KPI cards (§7.9).
