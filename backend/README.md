# Webitof CRM Backend

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
