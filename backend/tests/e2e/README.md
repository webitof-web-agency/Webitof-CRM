# End-to-end QA suites

Real HTTP tests against a **disposable local stack**. They create roles, users, leads, invoices,
payments and HRM records, so they must never reach the live database. `lib.js` refuses to run unless
`QA_API_URL` and `QA_DATABASE_URL` are both local, the API is not on port 5000 (the everyday backend
that points at the live DB) and the database name does not contain `prod`.

| Suite | What it checks |
|---|---|
| `rbacMatrix.e2e.js` | Every route (read from the Express router) × 9 roles: 401 without a token, 403 when the guard denies, never a 5xx |
| `security.e2e.js` | Forged/expired/purpose tokens, deactivated users, login enumeration, rate limits, profile mass assignment, Super Admin takeover paths, events IDOR, hostile input, HRM scoping |
| `finance.e2e.js` | GST (intra/inter/inclusive), rounding, impossible lines, numbering race, payments (partial, over, racing, by number), credit notes, reports |
| `crm.e2e.js` | Lead validation, phone normalisation + duplicates, webhook, visibility per role and pipeline, lost/won rules, conversion race, follow-ups, AMC/renewal/expense values, notifications |
| `hrm.e2e.js` | Geofenced clock-in (outside, mock, poor GPS, racing), leave rules, approvals by role |
| `load.js` | Script, not a test: seeds volume (`--seed`) and times heavy endpoints with N users (`--users=20`) |

UI role tests live in `frontend/e2e` (Playwright).

## Running

1. Local Postgres on 55432 and an empty database, e.g. `createdb webitofcrm_qa`.
2. Start a QA backend with every integration blanked, so `.env` cannot fill them in (dotenv never
   overrides a variable that is already set):

   ```sh
   export PORT=5055 NODE_ENV=development \
     DATABASE_URL=postgresql://webitof:webitof_dev@127.0.0.1:55432/webitofcrm_qa \
     ALLOW_PROD_DEV=false SKIP_DB_SETUP=false DISABLE_SCHEDULERS=true SEED_DEFAULT_DATA=true \
     JWT_SECRET=<any 32+ chars> SETTINGS_ENCRYPTION_KEY=<any> LEAD_WEBHOOK_KEY=qa-webhook-key-123 \
     SMTP_HOST= SMTP_USER= SMTP_PASSWORD= FIREBASE_SERVICE_ACCOUNT_PATH= \
     GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_OAUTH_REFRESH_TOKEN= GDRIVE_PARENT_FOLDER_ID= \
     BOOTSTRAP_ADMIN_EMAIL=qa.admin@webitof.test BOOTSTRAP_ADMIN_PASSWORD='QaAdmin@12345'
   node server.js        # not --watch: uploads written by the tests would restart it on Windows
   ```

3. Run the suites (security last: it floods the webhook limiter for a minute):

   ```sh
   export QA_API_URL=http://127.0.0.1:5055/api \
     QA_DATABASE_URL=postgresql://webitof:webitof_dev@127.0.0.1:55432/webitofcrm_qa \
     QA_JWT_SECRET=<the JWT_SECRET above>
   for s in rbacMatrix finance crm hrm security; do node --test --test-concurrency=1 tests/e2e/$s.e2e.js; done
   ```

Each run adds its own users and records (names carry a random tag), so the QA database grows; drop
and recreate it when you like.
