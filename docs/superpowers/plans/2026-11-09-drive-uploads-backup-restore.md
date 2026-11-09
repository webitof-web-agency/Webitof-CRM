# Drive uploads, 15-day backups and one-click restore — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Readable Drive upload folders, keep 15 daily database backups (`public` schema only), and an all-or-nothing restore that runs behind a maintenance mode.

**Architecture:** Builds on the existing `services/googleDrive/*` and `services/storage/*`. Two new focused units are added: `services/maintenance.service.js` (state saved to `uploads/.state/maintenance.json`) and `services/googleDrive/restore.service.js` (runs the steps in order, with injectable runners so it can be tested). An Express middleware enforces maintenance mode, and a React screen shows it.

**Tech Stack:** Node 22 / Express 4 / pg / node-cron / `node --test`; React 19 / Vite / Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-09-drive-uploads-backup-restore-design.md`

## Global Constraints

- Backups to keep: default **15** (Settings or `GDRIVE_BACKUP_KEEP` still win; allowed range 1–100).
- `pg_dump` and `pg_restore` use `--schema=public --no-owner --no-privileges`. Restore also uses `--clean --if-exists --single-transaction --exit-on-error`.
- New permission code `backups.restore` (module `settings`, action `restore`). The confirmation body is exactly `{ confirm: 'RESTORE' }`.
- 503 body: `{ success: false, code: 'MAINTENANCE', message: 'Under maintenance', maintenance: <public state> }`.
- Allowed during maintenance: `GET /api/health`, `GET /api/maintenance/status`, `POST /api/maintenance/clear`.
- Settings keys kept across a restore: `google_drive`, `google_drive_config`, `google_drive_backup`, `storage_settings`, `job:gdrive-db-backup`.
- Unit tests never touch a real database or Google. Integration tests only run with `TEST_DATABASE_URL` pointing at a throwaway local database.
- `ALLOW_PROD_DEV=true` → the restore endpoint returns 403.

## Review Focus

1. A record name with only symbols or emoji (e.g. "★★★") → the label sanitizes to empty, so the upload uses the ID folder and doesn't fail. *Test in Task 1.*
2. The label lookup throws (database down) → the upload still succeeds in the ID folder. *Test in Task 1.*
3. A restore is asked for while a backup is running (lock held) → 409, and maintenance is never entered. *Test in Task 4.*
4. The server restarts during a restore → it stays in maintenance with outcome `interrupted`, and clear works only for `backups.restore`. *Test in Task 3.*
5. `pg_restore` fails partway → the outcome is `failed`, maintenance is turned off, the temporary file is removed, and the preserved settings are still in place. *Test in Task 4.*

---

### Task 1: Readable upload folders

**Files:** Create `backend/services/storage/entityLabel.service.js`. Modify `backend/utils/uploadPath.js` and `backend/services/file.service.js`. Test `backend/tests/uploadFolders.test.js`.

**Interfaces:**
- Produces `resolveEntityLabel(section: string, entityId: string) → Promise<string|null>` and `setLabelLookupForTests(fn|null)`, where `fn(table, columns[], id) → row|null`.
- Produces `buildFolderPath({ moduleName, entityId, entityLabel, date })`. With a label, the record folder is `<sanitized label ≤50>-<last 4 [A-Za-z0-9] of entityId>`.

- [ ] Write the tests:
  - `buildFolderPath({moduleName:'projects', entityId:'proj_x8k2', entityLabel:'Acme Website!', date})` → `2026/nov/projects/Acme-Website-x8k2`
  - label `'★★★'` → `.../projects/proj_x8k2`
  - a 120-character label is cut to 50 characters before `-x8k2`
  - `resolveEntityLabel('clients', id)` uses company_name, else name. Expenses give `vendor` plus `-<invoice_number>`. Unknown section → null, a lookup that throws → null.
  - `saveUpload` with the stub label stores `folderKey` containing the label.
- [ ] Run `node --test tests/uploadFolders.test.js` and check it FAILS.
- [ ] Implement. The section map is `projects→projects[title]`, `clients→clients[company_name,name]`, `leads→leads[company_name,name]`, `users→users[full_name]`, `lead-events→lead_events[title]`, `invoices→invoices[invoice_number]`, `expenses→expenses[vendor,invoice_number]`. Table and column names are constants only. `saveUpload` resolves the label only when `entityId` is set and the module is not a site module.
- [ ] Run the new test and `npm run test:storage` and check they PASS. Stub the label lookup in `googleDrive.test.js` so it never reaches `config/db`.
- [ ] Commit `feat(files): readable record folders in Drive uploads`.

### Task 2: Backups keep 15, public schema only, backup kinds, and the permission

**Files:** Modify `backend/config/googleDrive.js` (`DEFAULT_BACKUP_KEEP=15`), `backend/services/googleDrive/backup.service.js`, `backend/config/rbac.js`, `backend/controllers/googleDrive.controller.js`, `backend/.env.example`. Test: update `backend/tests/googleDrive.test.js`.

**Interfaces:**
- Produces `runBackup({ trigger, userId, kind })`, where `kind` is `'scheduled'|'manual'|'pre-restore'`. `pre-restore` adds `-pre-restore` before `.dump`.
- `listBackups()` items get `kind` (taken from the name suffix and the Drive `description`).
- `getBackupStatus({ user })`: `manualAllowed` = not production, or the user has `backups.restore`.
- Exports `getConnectionParams()` for restore.

- [ ] Update the tests: retention keeps the newest 15 (add 17 files, 3 removed). The pre-restore name parses and counts toward the limit. Dump args include `--schema=public` (check the args seen by the stubbed spawn). `manualAllowed` is true in production for a user with `backups.restore`.
- [ ] Run them and check they FAIL.
- [ ] Implement. Add the permission to `PERMISSIONS`. The controller's `runBackupNow` allows production when `hasPermission(req.user,'backups.restore')`, and `status` passes `req.user`.
- [ ] Run `npm run test:storage` and check it PASSES. Commit `feat(backups): keep 15, public schema only, backup kinds, backups.restore permission`.

### Task 3: Maintenance mode

**Files:** Create `backend/services/maintenance.service.js`, `backend/middlewares/maintenance.js` and `backend/routes/maintenance.routes.js`. Modify `backend/server.js` (mount before `apiRoutes`, call `loadOnStartup()`, guard the backup cycle), the `schedule*` functions in `amcAutomation`, `renewalAutomation`, `outsourcingAutomation` and `followUpEngine`, `hrm/automation.schedule` (`if (maintenance.isActive()) return;` at the start of each callback), and `backend/services/socketHub.service.js` (refuse connections while active, add `broadcastMaintenance()` which emits `system:maintenance` and then disconnects). Test `backend/tests/maintenance.test.js`.

**Interfaces:**
- `maintenance.enter({ reason, startedBy:{id,name}, backupFile:{id,name} })`, `setPhase(phase)`, `finish(outcome, error?)` (sets `active=false` unless `outcome==='interrupted'`), `clear(actor)` (throws 409 while `phase` is running with no outcome), `get()`, `publicState()`, `isActive()`, `loadOnStartup()`, `setStateFileForTests(path)`.
- Middleware `maintenanceGate(req,res,next)`. It also tracks requests in progress: `inFlight()` and `waitForDrain(ms) → Promise<boolean>`.
- Routes: `GET /maintenance/status` (public), `POST /maintenance/clear` (`requireAuth` + `requirePermission('backups.restore')`).

- [ ] Write the tests:
  - The state survives reloading the file.
  - `loadOnStartup` with an unfinished restore → `active:true, outcome:'interrupted'`.
  - The gate returns 503 with the exact body for `/api/leads`, and lets health, status and clear through.
  - `clear` while running → 409. After `interrupted` → inactive.
  - `waitForDrain` resolves true when the in-flight count reaches 0, false after the timeout.
- [ ] Run and check they FAIL. Implement. The state file goes in `path.join(__dirname,'..','uploads','.state','maintenance.json')`, written atomically (tmp + rename).
- [ ] Run and check they PASS. Commit `feat(maintenance): maintenance mode gate, persisted state, cron and socket guards`.

### Task 4: Restore

**Files:** Create `backend/services/googleDrive/restore.service.js`. Modify `backend/controllers/googleDrive.controller.js` (`restoreBackup`) and `backend/routes/googleDrive.routes.js` (`POST /backups/:fileId/restore`, needs `backups.restore`). Test `backend/tests/backupRestore.test.js`. Integration test `backend/tests/backupRestore.integration.js`.

**Interfaces:**
- `startRestore({ fileId, confirm, user }) → Promise<{ started:true }>`. Throws 400 for a bad confirmation, 403 when `ALLOW_PROD_DEV`, 404 when the file isn't in the list, 409 when busy or the lock is held. These checks happen **before** `maintenance.enter`. The run itself is kicked off without awaiting it, and `getLastRun()` returns it.
- Test hooks: `setRestoreDepsForTests({ restoreRunner(filePath), migrate(), downloadTo(fileId, filePath), backup(opts), acquireLock(), broadcast(), drain(ms) })`.
- Phases, in order: `enter-maintenance → drain → safety-backup → preserve-settings → download → restore → migrate → reapply-settings → finish`.
- Outcomes: `success`, `aborted` (safety backup failed), `failed` (download or pg_restore failed), `restored-with-warnings` (migrate or reapply failed).

- [ ] Write the stubbed tests: the phase order; a bad confirm gives no maintenance; a held lock → 409 with no maintenance; a failing safety backup → `aborted` and the restore runner is never called; a throwing runner → `failed`, inactive, temp dir removed; success → the preserved settings keys keep their pre-restore values even when the runner overwrites them; the `pg_restore` args contain the Global Constraints flags and no password.
- [ ] Run and check they FAIL. Implement. The default `restoreRunner` spawns `PG_RESTORE_PATH||'pg_restore'` with the connection settings from `backup.getConnectionParams()`, the same way as `pg_dump`, and a timeout of `RESTORE_TIMEOUT_MINUTES||30`. The default `migrate` is `require('../../config/initDb').ensureDatabase`.
- [ ] Run the tests and check they PASS.
- [ ] Integration test (skipped without `TEST_DATABASE_URL`): create table `restore_probe`, insert 'before', dump with the real `pg_dump`, update to 'after', and write `system_settings` key `google_drive` = `{v:'new'}`. Run the real restore runner with a stubbed migrate. Check the probe is 'before', and that `google_drive` is `{v:'new'}` after reapply.
- [ ] Run it against a throwaway local database (`createdb crm_restore_test`) and check it PASSES, then drop the database. Commit `feat(backups): one-click restore from Drive behind maintenance mode`.

### Task 5: Frontend

**Files:** Modify `frontend/src/api/client.js` (a 503 with `MAINTENANCE` dispatches `window` event `system:maintenance` with the payload; add `api.maintenance.status/clear` and `api.googleDrive.restore(token,fileId)`). Modify `frontend/src/context/NotificationContext.jsx` (socket `system:maintenance` → the same window event). Create `frontend/src/components/layout/MaintenanceScreen.jsx` and mount it in `App.jsx` after `<ConfirmHost/>`. In `frontend/src/components/settings/StorageSettingsPanel.jsx` add a kind badge column, a Restore button (for `hasPermission('backups.restore')`), and a restore dialog that needs `RESTORE` typed. Pass `canRestore` from `SettingsPage.jsx`.

- [ ] Implement. MaintenanceScreen: hidden until the event fires, or until the first `status` poll on load returns active. Poll every 5 s. Reload when it becomes inactive and the screen was shown. Show the phase and start time in IST. If the outcome is `interrupted`/`failed`/`aborted` and the user can restore, show the error and an "Exit maintenance" button.
- [ ] Run `npm run lint && npm run build` in `frontend/` and check there are no errors. Commit `feat(ui): maintenance screen and restore from Drive backups`.

### Task 6: Docs, full check, memory

- [ ] `.env.example`: `GDRIVE_BACKUP_KEEP=15`, `PG_RESTORE_PATH=pg_restore`, `RESTORE_TIMEOUT_MINUTES=30`, and a note that `BACKUP_DATABASE_URL` must be session/direct. Update the restore paragraph in `backend/README.md`. Add `tests/uploadFolders.test.js tests/maintenance.test.js tests/backupRestore.test.js` to `test:storage`.
- [ ] Run the CI command (`find tests -maxdepth 1 -name "*.test.js" -not -name googleDrive.test.js | xargs node --test`), the `node --check` sweep, and frontend lint and build. All must pass.
- [ ] Update the memory palace room `drive-storage-backup-restore`. Commit `docs: backup and restore setup notes`.
