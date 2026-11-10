// Required first by every integration test that touches a database.
//
// Those tests write inside a transaction they roll back, but the services they call still read
// through the shared pool and send push notifications to real devices. Against the live
// database from backend/.env that reaches real staff, so they run only when TEST_DATABASE_URL
// names a disposable database, and DATABASE_URL is pointed at it before config/db loads.
const path = require("path");

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  const file = path.basename(require.main?.filename || "this test");
  console.log(`# skipped ${file}: set TEST_DATABASE_URL to a disposable database to run it`);
  process.exit(0);
}
process.env.DATABASE_URL = url;
// No push notifications from tests, whatever the local .env configures.
process.env.FIREBASE_SERVICE_ACCOUNT_PATH = "";
