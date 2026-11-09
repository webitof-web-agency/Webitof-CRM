# Google Drive uploads, 15-day backups, and one-click restore — design

Date: 2026-11-09
Status: Draft, waiting for review

## 1. Goal

Store every uploaded file in Google Drive under `<year>/<month>/<section>/<record>`. Back up the whole database to Drive every day and keep 15 days. Let an admin download any backup, or restore it with one click. During a restore the site goes into maintenance mode and nobody else can use it.

The admin only gives a parent folder ID or link. The app creates the "Uploads" and "DB Backups" folders under it if they are missing.

### Decisions made with the user

| Topic | Decision |
|---|---|
| Backup schedule | Daily (02:00 IST by default), keep the newest **15** |
| Backup contents | Database only (one `pg_dump`). Drive files stay in Drive; the file rows in the database point to them |
| Upload folder per record | `<section>/<Readable-Name>-<short-id>`, e.g. `projects/Acme-Website-x8k2` |
| Restore method | All-or-nothing `pg_restore` into the live database in one transaction, behind maintenance mode |
| Who can restore | New permission `backups.restore` (Admin role only by default) plus typing `RESTORE` |

## 2. What exists today (checked 2026-11-09)

Built in commit `8a7ab89`. The storage tests pass (`npm run test:storage`: 44 pass, 1 skipped because it needs `TEST_DATABASE_URL`).

- **Drive connection:** OAuth, with the refresh token encrypted in `system_settings`. Settings → Storage & Backup edits the client ID and secret, redirect URI, parent folder, folder names, how many backups to keep, and the backup hour (`services/googleDrive/*`, `config/googleDrive.js`).
- **Root folders:** `driveConnection.ensureFolder('uploads' | 'backup')` finds or creates both folders under `parentFolderId`. It stores their IDs and renames them in place when the name setting changes. **No change needed.**
- **Upload layout:** `utils/uploadPath.buildFolderPath` gives `<year>/<mon>/<section>/<entityId>` in IST. Branding uploads go to `site/`. `gdrive.provider` creates the missing folders, with a cache and a guard so two uploads at once don't create the same folder twice. Each `file_assets` row keeps its own provider and Drive file ID, so old files keep working when the layout changes.
- **Backups:** `services/googleDrive/backup.service.js` runs `pg_dump --format=custom`, uploads the file, and keeps the newest `backupKeep` (default **7**). A cross-process advisory lock stops two backups running at once. Scheduled once per IST day from `server.js`, checked every 15 minutes. It has list and download endpoints. "Back up now" is **blocked in production**.
- **Deployment:** one Node process under pm2 (`WebitofCRM-backend`) in `/www/wwwroot/WebitofCRM/backend`. The deploy uses `rsync --delete` and excludes `.env`, `node_modules`, `logs` and `uploads`. The database is Supabase (pooler, ap-south-1).
- **Permissions:** `config/rbac.js`. When `SEED_DEFAULT_DATA=true`, startup gives the default roles their default permissions (Admin gets every code). Super admins skip all permission checks.

### Gaps this design closes

1. Record folders use internal IDs, which are hard to read in Drive.
2. Backups are kept for 7 days, not 15.
3. `pg_dump` dumps every schema. On Supabase that includes `auth`, `storage` and others that our database role cannot restore. Backups must cover only `public`.
4. There's no restore and no maintenance mode.
5. Drive connection state lives in `system_settings`, so restoring an old dump would bring back an old refresh token and old folder IDs. A restore must keep the current values.

### Not checked yet (production reads were blocked)

These have to be checked on the server or live database before release. The implementation plan has a step for this.

- Whether Drive is connected now, and whether the latest scheduled backup succeeded.
- The Supabase server's Postgres version. The `pg_dump` and `pg_restore` on the server must be the same major version or newer.
- Whether `BACKUP_DATABASE_URL` is set to a **session or direct** connection. The transaction pooler cannot run `pg_restore --single-transaction`.
- Whether production runs with `SEED_DEFAULT_DATA=true`, which decides whether Admin gets the new permission on its own.
- The database size, which decides how long a restore takes and the timeout.

## 3. Design

### 3.1 Readable upload folders

`buildFolderPath({ moduleName, entityId, entityLabel, date })`:

```
<year>/<mon>/<section>/<label>-<shortId>/      when a label is found
<year>/<mon>/<section>/<entityId>/             fallback (today's behaviour)
<year>/<mon>/<section>/                        no record
site/                                          branding and settings
```

- `label` = `sanitizeSegment(name)` trimmed to 50 characters. `shortId` = the last 4 letters or digits of `entityId`, so two records with the same name never share a folder.
- New `services/storage/entityLabel.service.js` exports `resolveEntityLabel(section, entityId)`. It looks up a fixed map from section to table and name column. **The browser never sends the label.**

  | Section | Table | Label column |
  |---|---|---|
  | projects | projects | title |
  | clients | clients | company_name, else name |
  | leads | leads | company_name, else name |
  | users | users | full_name |
  | lead-events | lead_events | title |
  | invoices | invoices | invoice_number |
  | expenses | expenses | vendor, plus invoice_number when present (e.g. `Hostinger-INV-221-e1a0`) |

  Any other section, a missing row, or a lookup error gives `null`. The upload then uses the ID folder, and a failed lookup never blocks an upload. The table and column names are constants in code, never built from what the user sends.
- `file.service.saveUpload` calls the resolver before `buildFolderPath`. `folder_key` stores the folder path that was actually used, so the Files browser shows the readable names.
- **Fixed at upload time:** renaming a record does not move files that are already uploaded. Existing files are not migrated.

### 3.2 Backups

- `DEFAULT_BACKUP_KEEP` changes from 7 to **15** (`config/googleDrive.js`). A value saved in Settings or in `GDRIVE_BACKUP_KEEP` still wins. Update `.env.example` to say 15.
- `pg_dump` gets `--schema=public`. The file stays custom format, compression 6, with `--no-owner` and `--no-privileges`.
- File names get a kind:
  - `crm-backup-<db>-<stamp>-IST.dump`: scheduled or manual, as today
  - `crm-backup-<db>-<stamp>-IST-pre-restore.dump`: the safety copy taken before a restore

  `isOwnBackupName` accepts both. The list shows `kind`: `scheduled` / `manual` / `pre-restore`. The scheduled and manual kinds are recorded in the Drive file's `description`. Pre-restore copies count toward the 15 like any other backup.
- "Back up now" works in production for users with `backups.restore`. Users with only `settings.write` keep today's rule: allowed outside production only.

### 3.3 Maintenance mode

New `services/maintenance.service.js`. It has one job: hold and save the state.

- The state lives **in memory**, with a copy in `<backend>/uploads/.state/maintenance.json` (deploys skip `uploads/`, so it survives them, and it survives a restart). The database is not used, because the restore replaces it.
- State: `{ active, reason: 'restore', startedAt, startedBy: { id, name }, backupFile: { id, name }, phase, error, finishedAt, outcome }`.
- Functions: `enter(details)`, `setPhase(phase)`, `finish(outcome, error)`, `clear(actor)`, `get()`, `isActive()`, and `loadOnStartup()`.

New middleware `middlewares/maintenance.js`, mounted in `server.js` before `API_PREFIX` routes:

- While active, every `/api/*` request returns **503** with `{ success: false, code: 'MAINTENANCE', message: 'Under maintenance', maintenance: <public state> }`. Two paths are allowed through:
  - `GET /api/health`
  - `GET /api/maintenance/status` (no login needed; returns only the public fields: `active`, `phase`, `startedAt`, `outcome`, `error`, with no user details)
- `POST /api/maintenance/clear` also gets through, but it requires login and `backups.restore`. It is refused (409) while a restore is still running, and only works once the restore has stopped (outcome `failed`, `aborted` or `interrupted`). By then the database is either fully the old data or fully the backup, so checking the user's login against it is safe.
- Socket.io: when maintenance turns on, the server emits `system:maintenance` to everyone, then disconnects all sockets. New socket connections are refused while it's active.
- Scheduled jobs: every scheduled entry point (backup cycle, AMC, renewal, outsourcing, follow-up, HRM realtime and daily) checks `maintenance.isActive()` first and skips if true. This uses one shared helper (`skipIfMaintenance(name, fn)`) instead of a check copied into each job.

### 3.4 Restore

New `services/googleDrive/restore.service.js`. Endpoint `POST /api/google-drive/backups/:fileId/restore`, which needs `backups.restore` and body `{ confirm: 'RESTORE' }`. It returns **202** right away and the restore runs in the background. The restore takes the same advisory lock as backup, so the two never overlap. If a backup or restore is already running, the endpoint returns 409.

Steps, in order. `phase` is updated at each one:

1. **validate**: `fileId` must be in `listBackups()` (this server's own files only). `pg_restore` must exist (`PG_RESTORE_PATH`, default `pg_restore`). If either fails, return 400 or 409 **before** entering maintenance.
2. **enter-maintenance**: `maintenance.enter(...)`, broadcast to sockets and disconnect them.
3. **drain**: wait until requests already running finish. A counter in the middleware tracks them. Wait at most 30 seconds, then go on.
4. **safety-backup**: take a `pre-restore` backup of the current database. **If it fails, stop:** leave maintenance with outcome `aborted` and an error, and the data stays as it was.
5. **preserve-settings**: read the `system_settings` rows `google_drive`, `google_drive_config`, `google_drive_backup`, `storage_settings` and `job:gdrive-db-backup` into memory.
6. **download**: stream the chosen dump to a temporary file.
7. **restore**: `pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error --schema=public --dbname=…`, using the same connection settings as `pg_dump` (`BACKUP_DATABASE_URL` first). Passwords are hidden in error messages. The timeout is 30 minutes and can be changed with `RESTORE_TIMEOUT_MINUTES`. If it fails, the transaction rolls back, the data stays as it was, and the outcome is `failed`.
8. **migrate**: run `ensureDatabase()`, so an older dump gets the newer tables and columns. It's idempotent, the same as a restart. Demo seeding stays behind its existing flags.
9. **reapply-settings**: write back the rows saved in step 5 with `setSetting`, then reset the Drive config and connection caches (`refreshDriveSettings({ force: true })`, `connection.resetCache()`, `clearFolderCache()`).
10. **finish**: outcome `success`, then leave maintenance. Log a line with who restored which file, from what time, and how long it took. The temporary dump is deleted in a `finally` block.

If step 8 or 9 fails, the outcome is `restored-with-warnings`. The data is restored, so the site leaves maintenance and the error is shown in Settings.

**Crash during a restore:** on startup, `loadOnStartup()` finds `active: true` with outcome unset. It sets outcome `interrupted` and **stays in maintenance**. The startup log says so. An admin checks the result, then uses "Exit maintenance" (`/api/maintenance/clear`). Because of `--single-transaction`, the database is fully the old data or fully the backup, never a mix.

### 3.5 Frontend

- `api/client.js`: a 503 with `code: 'MAINTENANCE'` sends a `system:maintenance` window event. The socket `system:maintenance` event does the same.
- New `components/layout/MaintenanceScreen.jsx`, mounted at the app root. On that event it covers the whole app with "Under maintenance — data is being restored, started 14:02 IST" and the current phase. It calls `GET /api/maintenance/status` every 5 seconds. When `active` becomes false, it reloads the page. If the outcome is `interrupted` or `failed` and the user has `backups.restore`, it shows the error and an "Exit maintenance" button.
- `StorageSettingsPanel.jsx`, backup list: each row shows date, size and kind, with **Download** and **Restore** buttons (Restore only for `backups.restore`). Restore opens a dialog that names the backup and its time, says "everything entered after this time will be lost; a safety backup is taken first", and enables the button only when `RESTORE` is typed. On success, the person restoring sees the maintenance screen too.
- "Back up now" is shown when `manualAllowed` is true. The backend sets it for `backups.restore` holders in production.

### 3.6 Permissions

Add `{ code: 'backups.restore', module: 'settings', action: 'restore' }` to `config/rbac.js`. Admin gets it through `PERMISSION_CODES`. No other default role gets it.

## 4. Errors and safety

- Nothing changes the database before the safety backup succeeds.
- Only file IDs from this server's own backup list can be restored, so the endpoint can't be used to fetch any other Drive file.
- The user must type the confirmation, and needs the permission. Each restore is logged with who started it.
- Restore and backup share one advisory lock.
- Secrets never reach logs or API responses. Connection passwords are hidden in `pg_dump` and `pg_restore` errors.
- Local machines pointed at the live database (`DISABLE_SCHEDULERS=true` / `ALLOW_PROD_DEV=true`): the restore endpoint refuses with 403 when `ALLOW_PROD_DEV=true`, so a laptop can never restore production.

## 5. Testing

Unit tests, run in CI:

- `uploadPath` builds the readable folder, the ID fallback, and the site paths, and trims long names.
- `entityLabel` maps every section, and returns `null` for an unknown section, a missing row, or a database error.
- Retention keeps 15 by default, and pre-restore files count toward it. The name parser accepts the pre-restore suffix.
- The maintenance middleware returns 503 with the right body, lets the allowed paths through, and checks permission on clear.
- The maintenance service saves the state to its file. `loadOnStartup` turns an unfinished restore into `interrupted`.
- Restore order, with `pg_restore`, Drive and the lock stubbed: no maintenance when validation fails. A failed safety backup stops the restore. A failed `pg_restore` gives outcome `failed`. Settings are put back after a success. Cleanup always runs.
- Scheduled jobs skip while maintenance is on.

Integration test (`tests/backupRestore.integration.js`, not in CI, needs `TEST_DATABASE_URL` pointing at a **throwaway local** database):

- Seed, dump, change the data, restore, and check the original data is back and the preserved settings rows kept their new values.

Production is never used for tests.

## 6. Out of scope

- Backing up file contents, or files stored on local disk.
- Restoring a dump uploaded from a computer (only Drive backups can be restored).
- Moving existing uploads into the new folder names.
- Clusters with several app servers. Maintenance state is per process, which fits the single pm2 process in production.

## 7. Rollout

1. Merge. CI runs the unit tests.
2. On the server: check `pg_restore --version` against the Supabase server version, and set `BACKUP_DATABASE_URL` to the session pooler (port 5432) or direct connection.
3. Deploy. Take a manual backup and check it appears with kind `manual`.
4. Rehearse a restore on a **staging copy**, not production: restore the backup that was just taken. Time it and update `RESTORE_TIMEOUT_MINUTES` if needed.
