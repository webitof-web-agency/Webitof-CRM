// Real dump → change → restore against a THROWAWAY local database. Never point this at a real one.
//   TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:55432/crm_restore_test node --test tests/backupRestore.integration.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const url = process.env.TEST_DATABASE_URL || '';
const host = url ? new URL(url).hostname : '';
const skip = !url ? 'set TEST_DATABASE_URL to run' : (!['127.0.0.1', 'localhost', '::1'].includes(host) && 'TEST_DATABASE_URL must be a local throwaway database');

if (!skip) {
  process.env.DATABASE_URL = url;
  process.env.BACKUP_DATABASE_URL = url;
  process.env.DB_SSL = 'false';
  delete process.env.ALLOW_PROD_DEV;
}

test('a Drive backup restores over newer data and newer tables, keeping the Drive settings', { skip }, async () => {
  const { query, closePool } = require('../config/db');
  const backup = require('../services/googleDrive/backup.service');
  const restore = require('../services/googleDrive/restore.service');
  const maintenance = require('../services/maintenance.service');
  const os = require('os');
  const path = require('path');
  maintenance.setStateFileForTests(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'crm-int-')), 'm.json'));

  try {
    await query('drop table if exists credit_probe, restore_probe, system_settings cascade');
    await query('create table system_settings (key text primary key, payload jsonb not null, updated_at timestamptz default now())');
    await query('create table restore_probe (id text primary key, value text not null)');
    await query("insert into restore_probe values ('p1', 'before')");
    await query(`insert into system_settings (key, payload) values ('google_drive', '{"token":"old"}'), ('company', '{"name":"before"}')`);

    const dump = await backup.makeDump({ kind: 'scheduled' });
    const saved = path.join(os.tmpdir(), `crm-int-${Date.now()}.dump`);
    fs.copyFileSync(dump.filePath, saved);
    await dump.cleanup();

    // After the backup: data changes, a newer table references a restored one, Drive is reconnected.
    await query("update restore_probe set value = 'after'");
    await query('create table credit_probe (id text primary key, probe_id text references restore_probe(id))');
    await query("insert into credit_probe values ('c1', 'p1')");
    await query(`update system_settings set payload = '{"token":"new"}' where key = 'google_drive'`);
    await query(`update system_settings set payload = '{"name":"after"}' where key = 'company'`);

    const FILE = { id: 'f1', name: 'crm-backup-test.dump' };
    restore.setRestoreDepsForTests({
      listBackups: async () => [FILE],
      acquireLock: async () => async () => {},
      broadcast: () => {},
      drain: async () => true,
      backup: async () => ({ status: 'SUCCESS' }),
      downloadTo: async (fileId, filePath) => fs.copyFileSync(saved, filePath),
      migrate: async () => {},
      resetCaches: () => {}
    });

    await restore.startRestore({ fileId: 'f1', confirm: 'RESTORE', user: { id: 'u1' } });
    const run = await restore.waitForCurrentRun();
    assert.equal(run.outcome, 'success', run.error || '');
    assert.equal((await query("select value from restore_probe where id = 'p1'")).rows[0].value, 'before');
    assert.equal((await query("select to_regclass('public.credit_probe') as t")).rows[0].t, null, 'tables newer than the backup are gone');
    assert.deepEqual((await query("select payload from system_settings where key = 'company'")).rows[0].payload, { name: 'before' });
    assert.deepEqual((await query("select payload from system_settings where key = 'google_drive'")).rows[0].payload, { token: 'new' });

    // A broken dump fails inside the transaction and changes nothing.
    await query("update restore_probe set value = 'after-2'");
    restore.setRestoreDepsForTests({
      listBackups: async () => [FILE],
      acquireLock: async () => async () => {},
      broadcast: () => {},
      drain: async () => true,
      backup: async () => ({ status: 'SUCCESS' }),
      downloadTo: async (fileId, filePath) => {
        const bytes = fs.readFileSync(saved);
        fs.writeFileSync(filePath, bytes.subarray(0, Math.floor(bytes.length * 0.6)));
      },
      migrate: async () => {},
      resetCaches: () => {}
    });
    await restore.startRestore({ fileId: 'f1', confirm: 'RESTORE', user: { id: 'u1' } });
    const broken = await restore.waitForCurrentRun();
    assert.equal(broken.outcome, 'failed');
    assert.equal(broken.active, false);
    assert.equal((await query("select value from restore_probe where id = 'p1'")).rows[0].value, 'after-2');

    // A failure after the preamble has dropped everything rolls the whole transaction back.
    const wrapper = path.join(os.tmpdir(), `crm-int-psql-${Date.now()}.sh`);
    const badSql = path.join(os.tmpdir(), `crm-int-bad-${Date.now()}.sql`);
    fs.writeFileSync(badSql, 'select 1 / 0;\n');
    fs.writeFileSync(wrapper, `#!/bin/sh\nexec psql "$@" --file=${badSql}\n`, { mode: 0o755 });
    process.env.PSQL_PATH = wrapper;
    restore.setRestoreDepsForTests({
      listBackups: async () => [FILE],
      checkTools: async () => {},
      acquireLock: async () => async () => {},
      broadcast: () => {},
      drain: async () => true,
      backup: async () => ({ status: 'SUCCESS' }),
      downloadTo: async (fileId, filePath) => fs.copyFileSync(saved, filePath),
      migrate: async () => {},
      resetCaches: () => {}
    });
    try {
      await restore.startRestore({ fileId: 'f1', confirm: 'RESTORE', user: { id: 'u1' } });
      const lateFailure = await restore.waitForCurrentRun();
      assert.equal(lateFailure.outcome, 'failed');
      assert.match(lateFailure.error, /division by zero/);
      assert.equal((await query("select value from restore_probe where id = 'p1'")).rows[0].value, 'after-2');
      assert.ok((await query("select to_regclass('public.system_settings') as t")).rows[0].t, 'nothing was dropped');
    } finally {
      delete process.env.PSQL_PATH;
      fs.rmSync(wrapper, { force: true });
      fs.rmSync(badSql, { force: true });
    }
    fs.rmSync(saved, { force: true });
  } finally {
    restore.setRestoreDepsForTests(null);
    maintenance.setStateFileForTests(null);
    await closePool();
  }
});
