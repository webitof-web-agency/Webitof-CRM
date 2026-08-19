/*
 * Applies the additive, idempotent Advanced Follow-up Engine schema.
 * It does not backfill operational records or send customer messages.
 */
const path = require('path');
const { closePool, runSqlFile } = require('../config/db');

async function main() {
  const migration = path.join(__dirname, 'follow-up-engine.sql');
  await runSqlFile(migration);
  console.log(JSON.stringify({ applied: true, migration, customerMessagesSent: false }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => closePool());
