// Rehearsal on the REAL app schema (ensureDatabase) in a THROWAWAY local database: dump, change data,
// add a newer table that references a restored one, restore, then run the schema step again.
// Use an older server than the client tools to mimic Supabase, e.g. postgres:15 with pg_dump 18:
//   TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:55433/crm_schema_test node --test tests/backupRestore.schema.integration.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const url = process.env.TEST_DATABASE_URL || '';
const host = url ? new URL(url).hostname : '';
const skip = !url ? 'set TEST_DATABASE_URL to run' : (!['127.0.0.1', 'localhost', '::1'].includes(host) && 'TEST_DATABASE_URL must be a local throwaway database');

if (!skip) {
  process.env.DATABASE_URL = url;
  process.env.BACKUP_DATABASE_URL = url;
  process.env.DB_SSL = 'false';
  process.env.AUTO_INIT_DB = 'true';
  process.env.SEED_DEFAULT_DATA = 'true';
  for (const name of ['ALLOW_PROD_DEV', 'BOOTSTRAP_ADMIN_EMAIL', 'BOOTSTRAP_ADMIN_PASSWORD', 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE']) delete process.env[name];
}

async function counts(query) {
  const tables = (await query("select tablename from pg_tables where schemaname = 'public' order by 1")).rows.map((row) => row.tablename);
  const result = {};
  for (const table of tables) result[table] = Number((await query(`select count(*) from public."${table}"`)).rows[0].count);
  return result;
}

test('the real app schema survives dump → newer FK table → restore → schema update', { skip, timeout: 600000 }, async () => {
  const { query, closePool } = require('../config/db');
  const { ensureDatabase } = require('../config/initDb');
  const backup = require('../services/googleDrive/backup.service');
  const restore = require('../services/googleDrive/restore.service');
  const maintenance = require('../services/maintenance.service');
  maintenance.setStateFileForTests(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'crm-schema-')), 'm.json'));

  try {
    await query('create extension if not exists pg_trgm with schema public');
    await ensureDatabase();
    await query("create index if not exists clients_name_trgm on clients using gin (name gin_trgm_ops)");
    const before = await counts(query);
    assert.ok(Object.keys(before).length > 30, `expected the full schema, got ${Object.keys(before).length} tables`);

    const dump = await backup.makeDump({ kind: 'scheduled' });
    const saved = path.join(os.tmpdir(), `crm-schema-${Date.now()}.dump`);
    fs.copyFileSync(dump.filePath, saved);
    await dump.cleanup();

    // After the backup: a newer table with a foreign key into a restored table, plus changed data.
    await query('create table newer_feature (id text primary key, client_id text references clients(id), user_id text references users(id))');
    await query("insert into system_settings (key, payload) values ('google_drive', '{\"token\":\"current\"}') on conflict (key) do update set payload = excluded.payload");
    await query('delete from role_permissions');

    restore.setRestoreDepsForTests({
      listBackups: async () => [{ id: 'f1', name: 'crm-backup.dump' }],
      acquireLock: async () => async () => {},
      broadcast: () => {},
      drain: async () => true,
      backup: async () => ({ status: 'SUCCESS' }),
      downloadTo: async (fileId, filePath) => fs.copyFileSync(saved, filePath),
      // Compare rows straight after the restore; the startup seeding adds its own rows on a rerun.
      migrate: async () => {},
      resetCaches: () => {}
    });
    await restore.startRestore({ fileId: 'f1', confirm: 'RESTORE', user: { id: 'u1' } });
    const run = await restore.waitForCurrentRun();
    assert.equal(run.outcome, 'success', run.error || '');

    const after = await counts(query);
    assert.equal(after.newer_feature, undefined, 'tables newer than the backup are gone');
    for (const [table, count] of Object.entries(before)) {
      if (table === 'system_settings') continue;
      assert.equal(after[table], count, `${table} row count`);
    }
    assert.equal((await query("select count(*) from pg_extension where extname = 'pg_trgm'")).rows[0].count, '1');
    assert.ok((await query("select to_regclass('public.clients_name_trgm') as i")).rows[0].i, 'index using the extension came back');
    assert.deepEqual((await query("select payload from system_settings where key = 'google_drive'")).rows[0].payload, { token: 'current' });

    // The restore's schema step (ensureDatabase) must run cleanly on the restored database.
    await ensureDatabase();
    assert.ok((await query("select to_regclass('public.credit_notes') as t")).rows[0].t);
    fs.rmSync(saved, { force: true });
  } finally {
    restore.setRestoreDepsForTests(null);
    maintenance.setStateFileForTests(null);
    await closePool();
  }
});
