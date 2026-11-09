// One-click restore: order of steps, refusals before maintenance, failure outcomes, settings kept.
// No database, Drive or pg tools: every dependency is stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-restore-test-'));
process.env.DATABASE_URL = 'postgresql://crm_user:s3cret-pass@db.example.com:5432/crm';
delete process.env.BACKUP_DATABASE_URL;
delete process.env.ALLOW_PROD_DEV;

const settingsStore = require('../models/systemSetting.model');
const maintenance = require('../services/maintenance.service');
const restore = require('../services/googleDrive/restore.service');

const ADMIN = { id: 'user_admin', fullName: 'Admin', permissions: ['backups.restore'] };
const FILE = { id: 'f-backup', name: 'crm-backup-crm-2026-11-08_02-00-00-IST.dump', kind: 'scheduled' };
const PRESERVED = ['google_drive', 'google_drive_config', 'google_drive_backup', 'storage_settings', 'job:gdrive-db-backup'];

let memory;
let events;
let lockHeld;
let released;

function setup(overrides = {}) {
  memory = settingsStore.createMemoryStore({
    google_drive: { token: 'current-token' },
    google_drive_config: { parentFolderId: 'current-parent' },
    storage_settings: { activeProvider: 'gdrive' },
    company: { name: 'Before restore' }
  });
  settingsStore.setStoreForTests(memory);
  maintenance.setStateFileForTests(path.join(TMP, `state-${Date.now()}-${Math.random()}`, 'maintenance.json'));
  events = [];
  lockHeld = false;
  released = 0;
  const phaseOf = () => maintenance.get().phase;
  restore.setRestoreDepsForTests({
    listBackups: async () => [FILE],
    checkTools: async () => {},
    acquireLock: async () => {
      if (lockHeld) return null;
      events.push('lock');
      return async () => { released += 1; };
    },
    broadcast: () => events.push('broadcast'),
    drain: async () => { events.push(`drain@${phaseOf()}`); return true; },
    backup: async (options) => {
      events.push(`backup:${options.kind}:lockHeld=${options.lockHeld}@${phaseOf()}`);
      return { status: 'SUCCESS', fileName: 'safety.dump' };
    },
    downloadTo: async (fileId, filePath) => {
      events.push(`download:${fileId}@${phaseOf()}`);
      fs.writeFileSync(filePath, 'PGDMP');
    },
    restoreRunner: async (filePath) => {
      events.push(`restore:${fs.existsSync(filePath)}@${phaseOf()}`);
      // The backup carries old values for the settings that must survive.
      await settingsStore.setSetting('google_drive', { token: 'OLD-token' });
      await settingsStore.setSetting('storage_settings', { activeProvider: 'local' });
      await settingsStore.setSetting('company', { name: 'From backup' });
    },
    migrate: async () => { events.push(`migrate@${phaseOf()}`); },
    resetCaches: () => events.push('reset-caches'),
    ...overrides
  });
}

test.after(() => {
  restore.setRestoreDepsForTests(null);
  settingsStore.setStoreForTests(null);
  maintenance.setStateFileForTests(null);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('a restore runs every step in order and leaves maintenance with success', async () => {
  setup();
  const started = await restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN });
  assert.equal(started.started, true);
  assert.equal(maintenance.isActive(), true, 'maintenance is on as soon as the request returns');
  const run = await restore.waitForCurrentRun();
  assert.equal(run.outcome, 'success');
  assert.deepEqual(events, [
    'lock',
    'broadcast',
    'drain@drain',
    'download:f-backup@download',
    'backup:pre-restore:lockHeld=true@safety-backup',
    'restore:true@restore',
    'migrate@migrate',
    'reset-caches'
  ]);
  const state = maintenance.get();
  assert.equal(state.active, false);
  assert.equal(state.outcome, 'success');
  assert.equal(state.startedBy.id, 'user_admin');
  assert.equal(state.backupFile.id, FILE.id);
  assert.equal(released, 1);
});

test('settings that hold the Drive connection keep their current values; restored data stays restored', async () => {
  setup();
  await restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN });
  await restore.waitForCurrentRun();
  assert.deepEqual(await settingsStore.getSetting('google_drive'), { token: 'current-token' });
  assert.deepEqual(await settingsStore.getSetting('storage_settings'), { activeProvider: 'gdrive' });
  assert.deepEqual(await settingsStore.getSetting('company'), { name: 'From backup' });
  assert.equal(memory.data.has('job:gdrive-db-backup'), false, 'a key that did not exist is not invented');
  assert.ok(PRESERVED.every((key) => restore.PRESERVED_SETTINGS.includes(key)));
});

test('refusals happen before maintenance: bad confirm, unknown file, held lock, ALLOW_PROD_DEV', async () => {
  setup();
  await assert.rejects(() => restore.startRestore({ fileId: FILE.id, confirm: 'restore', user: ADMIN }), { statusCode: 400 });
  await assert.rejects(() => restore.startRestore({ fileId: 'someone-elses-file', confirm: 'RESTORE', user: ADMIN }), { statusCode: 404 });
  lockHeld = true;
  await assert.rejects(() => restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN }), { statusCode: 409 });
  lockHeld = false;
  process.env.ALLOW_PROD_DEV = 'true';
  try {
    await assert.rejects(() => restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN }), { statusCode: 403 });
  } finally {
    delete process.env.ALLOW_PROD_DEV;
  }
  assert.equal(maintenance.isActive(), false);
  assert.equal(maintenance.get().outcome, undefined);
});

test('missing pg tools are reported before maintenance', async () => {
  setup({ checkTools: async () => { throw Object.assign(new Error('pg_restore was not found'), { statusCode: 409, expose: true }); } });
  await assert.rejects(() => restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN }), /pg_restore was not found/);
  assert.equal(maintenance.isActive(), false);
});

test('a second restore while one runs is refused with 409', async () => {
  let finishRestore;
  setup({ restoreRunner: () => new Promise((resolve) => { finishRestore = resolve; }) });
  await restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN });
  await assert.rejects(() => restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN }), { statusCode: 409 });
  while (!finishRestore) await new Promise((resolve) => setTimeout(resolve, 5));
  finishRestore();
  assert.equal((await restore.waitForCurrentRun()).outcome, 'success');
});

test('a failed safety backup aborts before anything is restored', async () => {
  setup({ backup: async () => ({ status: 'FAILED', error: 'Drive quota exceeded' }) });
  await restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN });
  const run = await restore.waitForCurrentRun();
  assert.equal(run.outcome, 'aborted');
  assert.match(run.error, /Safety backup failed: Drive quota exceeded/);
  assert.ok(!events.some((event) => event.startsWith('restore')));
  assert.equal(fs.existsSync(restore.savedSettingsFile()), false);
  assert.equal(maintenance.isActive(), false);
  assert.equal(released, 1);
});

test('a failing pg_restore gives outcome failed, leaves maintenance, removes the temp file, keeps settings', async () => {
  let tempFile = '';
  setup({
    restoreRunner: async (filePath) => {
      tempFile = filePath;
      throw new Error('psql exited with code 3: ERROR: relation exists');
    }
  });
  await restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN });
  const run = await restore.waitForCurrentRun();
  assert.equal(run.outcome, 'failed');
  assert.match(run.error, /psql exited with code 3/);
  assert.equal(maintenance.isActive(), false);
  assert.equal(fs.existsSync(tempFile), false);
  assert.ok(!events.some((event) => event.startsWith('migrate')));
  assert.deepEqual(await settingsStore.getSetting('google_drive'), { token: 'current-token' });
});

test('a migrate failure after a good restore is restored-with-warnings, not failed', async () => {
  setup({ migrate: async () => { throw new Error('column already exists'); } });
  await restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN });
  const run = await restore.waitForCurrentRun();
  assert.equal(run.outcome, 'restored-with-warnings');
  assert.match(run.error, /column already exists/);
  assert.deepEqual(await settingsStore.getSetting('google_drive'), { token: 'current-token' }, 'settings are still put back');
});

test('the restore command loads the backup in one transaction with the public schema only and no password', () => {
  const { pgRestoreArgs, psqlArgs, env } = restore.buildRestoreCommands({ dumpPath: '/tmp/x.dump', tocPath: '/tmp/toc', sqlPath: '/tmp/x.sql', preamblePath: '/tmp/pre.sql' });
  assert.deepEqual(pgRestoreArgs.slice(0, 5), ['--use-list=/tmp/toc', '--no-owner', '--no-privileges', '--schema=public', '--file=-']);
  assert.ok(psqlArgs.includes('--single-transaction'));
  assert.ok(psqlArgs.includes('ON_ERROR_STOP=1'));
  assert.ok(psqlArgs.includes('--no-psqlrc'));
  assert.deepEqual(psqlArgs.filter((arg) => arg.startsWith('--file=')), ['--file=/tmp/pre.sql', '--file=/tmp/x.sql']);
  assert.ok(!JSON.stringify([pgRestoreArgs, psqlArgs]).includes('s3cret-pass'));
  assert.equal(env.PGPASSWORD, 's3cret-pass');
});

test('the backup TOC drops only the public schema entry, and transaction_timeout is stripped', () => {
  const toc = [
    ';',
    '5; 2615 2200 SCHEMA - public pg_database_owner',
    '3528; 0 0 COMMENT - SCHEMA public pg_database_owner',
    '220; 1259 16466 TABLE public invoices postgres',
    '3521; 0 16466 TABLE DATA public invoices postgres'
  ].join('\n');
  assert.deepEqual(restore.filterToc(toc).split('\n'), [
    ';',
    '220; 1259 16466 TABLE public invoices postgres',
    '3521; 0 16466 TABLE DATA public invoices postgres'
  ]);
  assert.equal(restore.keepSqlLine('SET transaction_timeout = 0;'), false);
  assert.equal(restore.keepSqlLine("SET statement_timeout = 0;"), true);
});

test('POST /google-drive/backups/:fileId/restore answers 202 and requires backups.restore', async () => {
  setup();
  const controller = require('../controllers/googleDrive.controller');
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let nextError = null;
  controller.restoreBackup({ params: { fileId: FILE.id }, body: { confirm: 'RESTORE' }, user: ADMIN }, res, (error) => { nextError = error; });
  // asyncHandler does not return its promise: wait for the response.
  while (!res.body && !nextError) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(nextError, null);
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.data.backup.id, FILE.id);
  await restore.waitForCurrentRun();

  const routes = require('../routes/googleDrive.routes');
  const layer = routes.stack.find((item) => item.route?.path === '/backups/:fileId/restore' && item.route.methods.post);
  assert.ok(layer, 'route is registered');
  const guard = layer.route.stack[0].handle;
  const denied = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } };
  guard({ user: { permissions: ['settings.write'] } }, denied, () => assert.fail('settings.write alone must not restore'));
  assert.equal(denied.statusCode, 403);
});

// ─── final-review fixes ──────────────────────────────────────────────────────

test('C1: the chosen backup is downloaded before the safety backup, so retention cannot delete it first', async () => {
  let deleted = false;
  setup({
    backup: async () => { deleted = true; return { status: 'SUCCESS' }; },
    downloadTo: async (fileId, filePath) => {
      if (deleted) throw new Error('Google Drive: File not found');
      fs.writeFileSync(filePath, 'PGDMP');
    }
  });
  await restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN });
  assert.equal((await restore.waitForCurrentRun()).outcome, 'success');
});

test('I1: the public state carries a generic message; the full error is only in the private state', async () => {
  setup({ restoreRunner: async () => { throw new Error('psql exited with code 3: DETAIL: Key (email)=(ceo@client.com) already exists, host db.abcd.supabase.co'); } });
  await restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN });
  await restore.waitForCurrentRun();
  const pub = JSON.stringify(maintenance.publicState());
  assert.ok(!pub.includes('ceo@client.com') && !pub.includes('supabase.co'), pub);
  assert.match(maintenance.publicState().error, /restore failed.*not changed/i);
  assert.match(maintenance.get().error, /ceo@client\.com/);
});

test('I2b: a step that hangs is timed out, so the site never stays in maintenance forever', async () => {
  process.env.RESTORE_TIMEOUT_MINUTES = '0.002';
  try {
    setup({ downloadTo: () => new Promise(() => {}) });
    await restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN });
    const run = await restore.waitForCurrentRun();
    assert.equal(run.outcome, 'failed');
    assert.match(run.error, /timed out/i);
    assert.equal(maintenance.isActive(), false);
  } finally {
    delete process.env.RESTORE_TIMEOUT_MINUTES;
  }
});

test('I2c: a broadcast that throws does not leave the lock held or maintenance on', async () => {
  setup({ broadcast: () => { throw new Error('socket hub down'); } });
  await restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN });
  const run = await restore.waitForCurrentRun();
  assert.equal(run.outcome, 'success');
  assert.equal(released, 1);
});

test('I3: writing the SQL to a path that cannot be written rejects instead of crashing the process', async () => {
  const { Readable: ReadableStream } = require('stream');
  await assert.rejects(
    () => restore.writeFilteredSql(ReadableStream.from(['SET transaction_timeout = 0;\nselect 1;\n']), path.join(TMP, 'no-such-dir', 'restore.sql')),
    { code: 'ENOENT' }
  );
  const ok = path.join(TMP, 'ok.sql');
  await restore.writeFilteredSql(ReadableStream.from(['SET transaction_timeout = 0;\nselect 1;\n']), ok);
  assert.equal(fs.readFileSync(ok, 'utf8'), 'select 1;\n');
});

test('I4: preserved settings are saved to disk during the restore and put back after a crash', async () => {
  let savedDuringRestore = null;
  setup({
    restoreRunner: async () => {
      savedDuringRestore = JSON.parse(fs.readFileSync(restore.savedSettingsFile(), 'utf8'));
      await settingsStore.setSetting('google_drive', { token: 'OLD-token' });
    }
  });
  await restore.startRestore({ fileId: FILE.id, confirm: 'RESTORE', user: ADMIN });
  await restore.waitForCurrentRun();
  assert.deepEqual(savedDuringRestore.google_drive, { token: 'current-token' });
  assert.equal(fs.existsSync(restore.savedSettingsFile()), false, 'removed once put back');

  // Simulate a crash after the restore committed: the file is still there on startup.
  fs.writeFileSync(restore.savedSettingsFile(), JSON.stringify({ google_drive: { token: 'current-token' }, storage_settings: null }));
  await settingsStore.setSetting('google_drive', { token: 'OLD-token' });
  assert.equal(await restore.reapplySavedSettings(), true);
  assert.deepEqual(await settingsStore.getSetting('google_drive'), { token: 'current-token' });
  assert.equal(fs.existsSync(restore.savedSettingsFile()), false);
  assert.equal(await restore.reapplySavedSettings(), false, 'nothing to do without the file');
});
