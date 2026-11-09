# Webitof CRM Backend

Advanced Follow-up Engine architecture, migration, API, permissions, QA and rollback guidance: [`../docs/ADVANCED_FOLLOW_UP_ENGINE.md`](../docs/ADVANCED_FOLLOW_UP_ENGINE.md).

Node.js + PostgreSQL backend for the Webitof client management CRM.

## Setup

1. Create a PostgreSQL database, for example `webitof_crm`.
2. Copy `.env.example` to `.env` and update the credentials.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the API:
   ```bash
   npm run start
   ```

## API Base

Default prefix: `/api`

## Main Routes

- `GET /api/health`
- `GET /api/clients`
- `GET /api/projects`
- `GET /api/invoices`
- `GET /api/payments`
- `GET /api/expenses`
- `GET /api/outsourcing`
- `GET /api/lead-commissions`
- `GET /api/banking/accounts`
- `GET /api/banking/transactions`
- `GET /api/amc`
- `GET /api/renewals`
- `GET /api/masters`
- `GET /api/masters/:type`
- `GET /api/settings`
- `GET /api/reports/dashboard`
- `GET /api/reports/profit-loss`
- `GET /api/reports/gst`
- `GET /api/reports/pending-payables`
- `GET /api/reports/ca-audit`
- `GET /api/reports/renewals`
- `GET /api/files`
- `POST /api/files/upload`
- `PATCH /api/files/:id/archive`

## Notes

- The database schema is defined in `database/schema.sql`.
- File metadata and folder mapping are defined in `database/storage.sql`.
- Default settings and master data are seeded automatically on startup.
- Finance totals are calculated server-side from invoice, expense, outsourcing, and commission data.

## Google Drive Uploads

This backend can upload images, documents, PDFs, and other binaries directly to Google Drive using the Drive API.

Recommended setup:

1. Create a Google Cloud project and enable the Google Drive API.
2. Create a service account or OAuth credentials.
3. If you use a service account, share your target Drive folder with the service account email.
4. Set `GOOGLE_DRIVE_ROOT_FOLDER_ID` to the shared folder ID, or let the backend create a root folder automatically.

Upload endpoint:

```bash
POST /api/files/upload
```

Form data:

- `files` or any multipart file field
- `moduleName` like `clients`, `projects`, `invoices`, `expenses`
- `entityId` like a client/project/invoice id
- `folderParts` optional extra nested folders, separated by `/`
- `isPublic=true` if you want the uploaded file to be publicly readable

The backend stores only metadata in PostgreSQL. The actual binary stays in Google Drive, so you avoid local disk loss risk.

## Google Drive backups and restore

Settings → Storage & Backup. Paste the parent folder id or link; the app creates the
"Uploads" and "DB Backups" folders inside it when they are missing.

- **Uploads** go to `Uploads/<year>/<mon>/<section>/<Record-Name>-<id4>/` (India time). The record
  name is fixed at upload time; logos and branding go to `Uploads/site/`.
- **Backups**: a `pg_dump` of the `public` schema every day at `GDRIVE_BACKUP_HOUR_IST` (02:00), newest
  15 kept. Files are named `crm-backup-<db>-<date>-IST[-manual|-pre-restore].dump`.
- **Restore** (permission `backups.restore`, Admin only by default; type `RESTORE` to confirm):
  1. The site goes into maintenance: every API call answers 503 except `/health` and
     `/maintenance/status`; sockets are closed; all crons skip. The state is kept in
     `uploads/.state/maintenance.json` so it survives a restart.
  2. A `-pre-restore` safety backup of the current data is uploaded. If it fails, nothing is changed.
  3. The backup is loaded with `psql --single-transaction`: `services/googleDrive/restore-preamble.sql`
     empties the app's objects in `public`, then the backup is replayed. Any error rolls everything back.
  4. `ensureDatabase()` adds tables/columns newer than the backup; the Drive connection and storage
     settings keep their current values; maintenance ends.
- The chosen backup is downloaded **before** the safety backup, and a safety backup never prunes
  old ones, so restoring the oldest of the 15 is safe.
- If the server stops mid-restore it starts again **in maintenance** with outcome `interrupted`; the
  Drive settings saved in `uploads/.state/restore-settings.json` are put back automatically. While a
  restore has stopped, sign-in still works, so an admin can read the error and press "Exit maintenance"
  (`POST /api/maintenance/clear`). Public status shows only a short message; the full error is at
  `GET /api/maintenance/details` (`backups.restore`) and in the server log.
- Locked out with nobody able to sign in, or a restore truly stuck: on the server run
  `npm run maintenance:clear`, then `pm2 restart WebitofCRM-backend`.
- Every step has a time limit (`RESTORE_TIMEOUT_MINUTES`, default 30).
- Server setup: `pg_restore` and `psql` installed (same major version as the database or newer) and
  `BACKUP_DATABASE_URL` set to the Supabase session pooler (port 5432) or the direct connection.
- Tests: `npm run test:storage`; the real dump/restore test needs a throwaway local database:
  `TEST_DATABASE_URL=postgres://…@127.0.0.1:…/crm_restore_test node --test tests/backupRestore.integration.js`.
