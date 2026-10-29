# Database backups (dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** System › Backups for the owner: automatic backups on/off and how often, Back up now, the list with Download / Copy restore command / Delete, and the last run's status.

**Architecture:** One API module (`lib/api/backups.ts`) over the server's `api/admin/v1/backups` routes, and three components in `components/backups/` (settings card, list with its two dialogs, page) composed by the route `app/(dashboard)/system/backups`. The page polls every 3 s only while a backup runs.

**Tech Stack:** Next.js 16.3, React 19, TanStack Query 5, Tailwind v4, shadcn/ui (`radix-ui`), lucide-react, Vitest 5 + Testing Library.

**Spec:** `../slimshot_server/docs/superpowers/specs/2026-10-29-database-backups-design.md` §6 (API), §10 (page). Server plan: `../slimshot_server/docs/superpowers/plans/2026-10-29-database-backups.md`.

## Global Constraints

- Context7 before framework code (TanStack Query `refetchInterval` with a function, Radix Select/Switch/Tooltip).
- shadcn primitives only. Content-shaped skeletons, never "Loading…". Dark tokens; the brand gradient only on the primary button. Dates via `lib/format.ts` (en-GB), sizes via the existing `formatBytes`.
- Owner only: the page renders inside `OwnerOnly`, and the nav item shows for the owner alone.
- Copy (exact):
  - title "Backups"; subtitle "Copies of the database in your private R2 bucket."; primary action "Back up now", reading "Backing up…" while one runs;
  - switch "Back up automatically"; interval labels "Every day", "Every 7 days", "Every 30 days";
  - not configured: `no-bucket` → "Backups are not set up yet. Add R2_BACKUP_BUCKET=slimshot-backups to the server's .env, then redeploy."; `not-production` → "Backups run only on the live server.";
  - newest-delete tooltip "The newest backup can't be deleted".
- Commits as in the server plan. Branch `feat/db-backups`.

## Review Focus

1. **The server answers `configured: false`**: no controls at all, just the explanation, and no download or delete calls. → Task 4 test.
2. **A backup finishing while the page is open**: polling stops, the list refreshes, a toast says how it went. → Task 4 test.
3. **Copying the restore command when the clipboard is unavailable** (`navigator.clipboard` undefined in a non-secure context): the command stays visible and selectable, and the button says "Select the command and copy it". → Task 3 test.
4. **Deleting the backup you're looking at while another finishes**: the list refetches after a delete, and the confirm names the backup's date. → Task 3 test.
5. **No backups yet** (first deploy): an empty state, "No backups yet. The first automatic one runs at 03:15 UTC.", or "No backups yet." when automatic backups are off. → Task 3 test.

---

### Task 1: API module, activity copy, navigation

**Files:**
- Create: `lib/api/backups.ts`
- Modify: `lib/activity-copy.ts` (+ test), `components/shell/nav-items.ts` (+ test), `components/shell/app-shell.test.tsx`, `components/system/system-header.tsx` (+ test)

**Interfaces:**
- Produces (`lib/api/backups.ts`):
  - `type BackupTrigger = 'auto' | 'manual'`; `type BackupInterval = 1 | 7 | 30`
  - `interface BackupItem { filename: string; sizeBytes: number; createdAt: string; trigger: BackupTrigger }`
  - `interface BackupsOverview { configured: boolean; notConfiguredReason: 'no-bucket' | 'not-production' | null; settings: { autoEnabled: boolean; intervalDays: BackupInterval }; status: { running: boolean; lastRunAt: string | null; lastRunOk: boolean | null; lastRunError: string | null; lastRunTrigger: BackupTrigger | null; nextAutoAt: string | null }; backups: BackupItem[] }`
  - `BACKUPS_KEY = ['backups'] as const`
  - `fetchBackups()`, `updateBackupSettings(patch)`, `startBackup()`, `fetchBackupDownload(filename) → { url, expiresAt }`, `fetchRestoreCommand(filename) → { command, expiresAt }`, `deleteBackup(filename)`. Every one goes through `withRefresh(apiFetch)`, and `filename` is `encodeURIComponent`-ed.
- Nav: owner System items become AI providers `/system/providers`, Sign-in security `/system/security`, **Backups `/system/backups` (`DatabaseBackup` icon)**, Audit log `/system/audit`. `SystemHeader` owner tabs gain Backups in the same place, and `SystemHeader` gains `actions?: ReactNode`.
- Activity copy for the audit actions:
  - `backup.created` → "made a backup"
  - `backup.failed` → "A backup failed"
  - `backup.deleted` → "deleted a backup"
  - `backup.downloaded` → "downloaded a backup"
  - `backup.restore_command` → "copied a restore command"
  - `backup.settings.updated` → "changed the backup schedule"
  
  Match the module's existing sentence shape.

- [ ] **Step 1: Update the failing tests**: the nav shape (owner System: providers, security, backups, audit; others: audit only); the app-shell sidebar hrefs; the system-header test's three-tab list becoming four; the activity copy for each action.
- [ ] **Step 2: Run** `npx vitest run components/shell components/system lib`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(backups): Backups in the System menu, and the API it reads`

---

### Task 2: Automatic backups card

**Files:**
- Create: `components/backups/auto-backup-card.tsx`, `components/backups/auto-backup-card.test.tsx`

**Interfaces:**
- Consumes: `updateBackupSettings`, `BACKUPS_KEY`, `BackupsOverview` (Task 1).
- Produces: `AutoBackupCard({ settings }: { settings: BackupsOverview['settings'] })`. A Switch and a Select. Save and Undo appear when either differs from `settings`. Save sends only what changed, writes the returned settings into the `BACKUPS_KEY` cache, and toasts "Saved." The Select is disabled while the switch is off.

- [ ] **Step 1: Write the failing tests**: shows the saved values; turning the switch off and saving sends `{ autoEnabled: false }` only; choosing "Every 7 days" sends `{ intervalDays: 7 }`; Undo restores; Save disabled when clean; the Select is disabled when off.
- [ ] **Step 2: Run** `npx vitest run components/backups/auto-backup-card.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(backups): switch automatic backups and choose how often`

---

### Task 3: Backup list and its dialogs

**Files:**
- Create: `components/backups/backup-list.tsx`, `components/backups/backup-list.test.tsx`

**Interfaces:**
- Consumes: `fetchBackupDownload`, `fetchRestoreCommand`, `deleteBackup`, `BACKUPS_KEY`, `BackupItem` (Task 1).
- Produces: `BackupList({ backups, autoEnabled }: { backups: BackupItem[]; autoEnabled: boolean })`.
  - A table of Date (`formatDateTime`), Size (`formatBytes`) and Type ("Automatic" or "Manual").
  - A row menu (`DropdownMenu modal={false}`, trigger `aria-label="Actions for the backup from {date}"`) with:
    - **Download**: fetch the link, then `window.location.assign(url)`.
    - **Copy restore command…**: a Dialog titled "Restore this backup". It shows the command in a `<pre>` with a Copy button, then "Valid for 1 hour. Run it in the server's folder on the VPS.", then "Restoring replaces everything written since this backup; the script asks you to type RESTORE and saves a safety copy first. To try it safely first, put --check after restore-db.sh."
    - **Delete…**: disabled with the tooltip on the first, newest, row. It opens an alertdialog "Delete the backup from {date}?" with Cancel and Delete; Delete calls `deleteBackup`, invalidates `BACKUPS_KEY` and toasts "Backup deleted."
  - Empty state per Review Focus 5.

- [ ] **Step 1: Write the failing tests**: rows show date, size and type; Download fetches and navigates (spy `window.location.assign`); the restore dialog shows the command and copies it (mock `navigator.clipboard.writeText`); with no clipboard the button reads "Select the command and copy it" and the `<pre>` stays (Review Focus 3); Delete is disabled on the newest with the tooltip text; deleting another asks with its date, calls `deleteBackup`, toasts and refetches (Review Focus 4); both empty states.
- [ ] **Step 2: Run** `npx vitest run components/backups/backup-list.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(backups): the list of backups with download, restore command and delete`

---

### Task 4: The Backups page

**Files:**
- Create: `components/backups/backups-page.tsx`, `components/backups/backups-page.test.tsx`, `app/(dashboard)/system/backups/page.tsx`

**Interfaces:**
- Consumes: Tasks 1–3; `SystemHeader` with `actions`; `OwnerOnly`.
- Produces: `BackupsPage()`:
  - It uses `useQuery({ queryKey: BACKUPS_KEY, queryFn: fetchBackups, refetchInterval: (q) => (q.state.data?.status.running ? 3000 : false) })`.
  - Header action: **Back up now** calls `startBackup`, then invalidates. A 409 toasts the server message.
  - Status line: "Last backup {formatDateTime} · Automatic|Manual" (or "No backup yet"), and "Next automatic backup {formatDateTime}" or "Automatic backups are off".
  - A failure callout when `lastRunOk === false`: "The last backup failed: {lastRunError}".
  - When `running` turns from true to false: toast "Backup finished." or "Backup failed." (error variant).
  - Not configured → only the explanation card.
  - Skeleton for the first load.
  - The route renders `SystemHeader` outside `OwnerOnly` and the content inside, like the AI providers page.

- [ ] **Step 1: Write the failing tests**:
  - not configured, both reasons: only the explanation, no buttons (Review Focus 1);
  - Back up now starts, then shows "Backing up…" and is disabled while `running`;
  - polling: with fake timers, `running: true` then `false` → `fetchBackups` called again, then the toast "Backup finished." and the list refreshed (Review Focus 2);
  - the failure callout;
  - the status line in both states;
  - the skeleton.
- [ ] **Step 2: Run** `npx vitest run components/backups`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run lint && npx tsc --noEmit`. Expected: all green.
- [ ] **Step 5: Commit** `feat(backups): System › Backups`

---

### Task 5: Verify in the browser

Done by the controller.

- [ ] **Step 1:** `npm run build`. Expected: exit 0.
- [ ] **Step 2:** Run the dev server against the stand-in API, with backups data added for each state: not configured, ready with three backups, running, last run failed. Screenshot `/system/backups` at 1440×900 and 390×844, the restore dialog, and the delete confirm.
- [ ] **Step 3:** Capture console errors. Expected: none.
