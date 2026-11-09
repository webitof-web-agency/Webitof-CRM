// One-click restore of a Drive backup. Runs behind maintenance mode, takes a safety backup first,
// and loads the backup in ONE transaction (psql --single-transaction): on any error the database
// is left exactly as it was. Drive connection settings keep their current values.
//
// Why not `pg_restore --clean`: it drops tables without CASCADE, so any table added after the
// backup that references a restored one (e.g. credit_notes → invoices) makes every restore fail.
// Instead restore-preamble.sql empties the app's objects in `public` (extensions stay) and the
// backup is replayed into the empty schema; ensureDatabase() then adds newer tables/columns.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { getSetting, setSetting } = require('../../models/systemSetting.model');
const maintenance = require('../maintenance.service');
const backup = require('./backup.service');

const PRESERVED_SETTINGS = ['google_drive', 'google_drive_config', 'google_drive_backup', 'storage_settings', 'job:gdrive-db-backup'];
const PREAMBLE_PATH = path.join(__dirname, 'restore-preamble.sql');
const DRAIN_MS = 30 * 1000;

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

function timeoutMs() {
  const minutes = Number(process.env.RESTORE_TIMEOUT_MINUTES || 30);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60 * 1000;
}

// ─── pg tools ────────────────────────────────────────────────────────────────

function connectionEnv() {
  const params = backup.getConnectionParams();
  const env = { ...process.env, PGPASSWORD: params.password };
  delete env.DATABASE_URL;
  delete env.BACKUP_DATABASE_URL;
  if (params.sslmode) env.PGSSLMODE = params.sslmode;
  else if (String(process.env.DB_SSL || '').toLowerCase() === 'true') env.PGSSLMODE = 'require';
  return { params, env };
}

function buildRestoreCommands({ dumpPath, tocPath, sqlPath, preamblePath = PREAMBLE_PATH }) {
  const { params, env } = connectionEnv();
  return {
    pgRestoreArgs: ['--use-list=' + tocPath, '--no-owner', '--no-privileges', '--schema=public', '--file=-', dumpPath],
    psqlArgs: [
      '--no-psqlrc',
      '--quiet',
      '--single-transaction',
      '--set', 'ON_ERROR_STOP=1',
      `--host=${params.host}`,
      `--port=${params.port}`,
      `--username=${params.user}`,
      `--dbname=${params.database}`,
      `--file=${preamblePath}`,
      `--file=${sqlPath}`
    ],
    env,
    password: params.password
  };
}

// The dump of `public` carries a CREATE SCHEMA public entry; the schema already exists.
function filterToc(toc) {
  return String(toc)
    .split('\n')
    .filter((line) => !/ SCHEMA - public | COMMENT - SCHEMA public /.test(line))
    .join('\n');
}

// pg_restore 17+ writes this; servers before PostgreSQL 17 reject it.
function keepSqlLine(line) {
  return !/^SET transaction_timeout\b/.test(line);
}

// Streams pg_restore's SQL into a file without the lines old servers reject. Errors (disk full,
// unwritable path) reject the promise instead of crashing the process.
function writeFilteredSql(input, sqlPath) {
  let carry = '';
  const filter = new Transform({
    transform(chunk, encoding, done) {
      const lines = (carry + chunk.toString()).split('\n');
      carry = lines.pop();
      done(null, lines.filter(keepSqlLine).map((line) => `${line}\n`).join(''));
    },
    flush(done) {
      done(null, carry && keepSqlLine(carry) ? carry : '');
    }
  });
  return pipeline(input, filter, fs.createWriteStream(sqlPath));
}

// A step that never settles (a stalled Drive download, a hung pg_dump) must not keep the
// site in maintenance forever. The late result is ignored; the next steps never run.
function withTimeout(promise, label) {
  let timer;
  const limit = timeoutMs();
  return Promise.race([
    promise,
    new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(limit / 1000)}s (RESTORE_TIMEOUT_MINUTES).`)), limit);
    })
  ]).finally(() => clearTimeout(timer));
}

function toolPath(name) {
  return name === 'psql' ? (process.env.PSQL_PATH || 'psql') : (process.env.PG_RESTORE_PATH || 'pg_restore');
}

function runTool(name, args, { env = process.env, password = '', stdout = 'ignore', timeout = timeoutMs() } = {}) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const child = spawn(toolPath(name), args, { env, stdio: ['ignore', stdout === 'ignore' ? 'ignore' : 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill('SIGTERM'), timeout);
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });
    if (stdout !== 'ignore') stdout(child.stdout);
    child.on('error', (error) => {
      clearTimeout(timer);
      if (error.code === 'ENOENT') reject(httpError(`${name} was not found. Install the PostgreSQL client tools or set ${name === 'psql' ? 'PSQL_PATH' : 'PG_RESTORE_PATH'}.`, 409));
      else reject(new Error(backup.redact(error.message, password)));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else if (signal) reject(new Error(`${name} was stopped (${signal}); the restore took longer than RESTORE_TIMEOUT_MINUTES`));
      else reject(new Error(`${name} exited with code ${code}: ${backup.redact(stderr.slice(-2000), password).trim()}`));
    });
  });
}

async function defaultCheckTools() {
  await runTool('pg_restore', ['--version'], { timeout: 15000 });
  await runTool('psql', ['--version'], { timeout: 15000 });
}

async function defaultRestoreRunner(dumpPath) {
  const dir = path.dirname(dumpPath);
  const tocPath = path.join(dir, 'toc.list');
  const sqlPath = path.join(dir, 'restore.sql');
  const commands = buildRestoreCommands({ dumpPath, tocPath, sqlPath });

  let toc = '';
  await runTool('pg_restore', ['--list', dumpPath], {
    stdout: (stream) => stream.on('data', (chunk) => { toc += chunk.toString(); })
  });
  await fs.promises.writeFile(tocPath, filterToc(toc));

  let written = Promise.resolve();
  await runTool('pg_restore', commands.pgRestoreArgs, {
    stdout: (stream) => {
      written = writeFilteredSql(stream, sqlPath);
      written.catch(() => {});
    }
  });
  await written;
  await runTool('psql', commands.psqlArgs, { env: commands.env, password: commands.password });
}

// ─── defaults that touch Drive / the database ───────────────────────────────

async function defaultDownloadTo(fileId, filePath) {
  const { response } = await backup.openBackup(fileId);
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(filePath));
}

function defaultResetCaches() {
  const { refreshDriveSettings } = require('../../config/googleDrive');
  const connection = require('./driveConnection.service');
  const { clearFolderCache } = require('../storage/providers/gdrive.provider');
  connection.resetCache();
  clearFolderCache();
  return refreshDriveSettings({ force: true });
}

function defaultBroadcast(state) {
  require('../socketHub.service').broadcastMaintenance(state);
}

const DEFAULT_DEPS = {
  listBackups: () => backup.listBackups(),
  checkTools: defaultCheckTools,
  acquireLock: () => backup.acquireBackupLock(),
  broadcast: defaultBroadcast,
  drain: (ms) => require('../../middlewares/maintenance').waitForDrain(ms),
  backup: (options) => backup.runBackup(options),
  downloadTo: defaultDownloadTo,
  restoreRunner: defaultRestoreRunner,
  migrate: () => require('../../config/initDb').ensureDatabase(),
  resetCaches: defaultResetCaches
};

let deps = DEFAULT_DEPS;
let current = null;

// The Drive connection rows, kept on disk (the token is already encrypted) for the window
// between the restore committing and the rows being put back. A crash there is repaired on startup.
function savedSettingsFile() {
  return path.join(maintenance.stateDir(), 'restore-settings.json');
}

async function reapplySavedSettings() {
  let saved;
  try {
    saved = JSON.parse(await fs.promises.readFile(savedSettingsFile(), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Saved Drive settings could not be read:', error.message);
    return false;
  }
  for (const key of PRESERVED_SETTINGS) {
    if (saved[key] !== null && saved[key] !== undefined) await setSetting(key, saved[key]);
  }
  await fs.promises.rm(savedSettingsFile(), { force: true });
  return true;
}

function setRestoreDepsForTests(overrides) {
  deps = overrides ? { ...DEFAULT_DEPS, ...overrides } : DEFAULT_DEPS;
}

// ─── the restore ─────────────────────────────────────────────────────────────

async function startRestore({ fileId, confirm, user } = {}) {
  if (confirm !== 'RESTORE') throw httpError('Type RESTORE to confirm.', 400);
  if (String(process.env.ALLOW_PROD_DEV || '').toLowerCase() === 'true') {
    throw httpError('Restores are disabled on a development machine pointed at the live database (ALLOW_PROD_DEV).', 403);
  }
  if (current || maintenance.isActive()) throw httpError('A restore or maintenance is already in progress.', 409);

  const file = (await deps.listBackups()).find((item) => item.id === fileId);
  if (!file) throw httpError('Backup not found', 404);
  await deps.checkTools();

  const release = await deps.acquireLock();
  if (!release) throw httpError('A backup is running. Try again when it has finished.', 409);
  try {
    maintenance.enter({
      reason: 'restore',
      startedBy: { id: user?.id || null, name: user?.fullName || user?.name || user?.email || '' },
      backupFile: { id: file.id, name: file.name }
    });
  } catch (error) {
    await release();
    throw error;
  }
  console.warn(`Restore of ${file.name} started by ${user?.id || 'unknown'}: site is in maintenance`);
  try {
    deps.broadcast(maintenance.publicState());
  } catch (error) {
    console.error('Maintenance broadcast failed (tabs will notice on their next request):', error.message);
  }
  current = run(file, user, release)
    .catch((error) => console.error('Restore crashed:', error))
    .finally(() => {
      current = null;
    });
  return { started: true, backup: file, maintenance: maintenance.publicState() };
}

async function run(file, user, release) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crm-restore-'));
  const dumpPath = path.join(dir, 'backup.dump');
  const startedAt = Date.now();
  let outcome = 'success';
  let error = '';
  const warnings = [];
  try {
    maintenance.setPhase('drain');
    await deps.drain(DRAIN_MS);

    // Download first: the safety backup must never push the chosen (oldest) backup out of Drive.
    maintenance.setPhase('download');
    try {
      await withTimeout(Promise.resolve().then(() => deps.downloadTo(file.id, dumpPath)), 'Downloading the backup');
    } catch (downloadError) {
      outcome = 'failed';
      error = `${downloadError.message} The database was not changed.`;
      return;
    }

    maintenance.setPhase('safety-backup');
    let safety;
    try {
      safety = await withTimeout(
        Promise.resolve().then(() => deps.backup({ trigger: 'restore', kind: 'pre-restore', userId: user?.id || null, lockHeld: true })),
        'The safety backup'
      );
    } catch (backupError) {
      safety = { status: 'FAILED', error: backupError.message };
    }
    if (safety?.status !== 'SUCCESS') {
      outcome = 'aborted';
      error = `Safety backup failed: ${safety?.error || safety?.status || 'unknown error'}. Nothing was changed.`;
      return;
    }

    maintenance.setPhase('preserve-settings');
    const saved = {};
    for (const key of PRESERVED_SETTINGS) saved[key] = await getSetting(key, null);
    await fs.promises.mkdir(maintenance.stateDir(), { recursive: true });
    await fs.promises.writeFile(savedSettingsFile(), JSON.stringify(saved), { mode: 0o600 });

    try {
      maintenance.setPhase('restore');
      await deps.restoreRunner(dumpPath);
    } catch (restoreError) {
      outcome = 'failed';
      error = `${restoreError.message} The database was not changed.`;
      return;
    }

    maintenance.setPhase('migrate');
    try {
      await deps.migrate();
    } catch (migrateError) {
      warnings.push(`Schema update after restore failed: ${migrateError.message}`);
    }

    maintenance.setPhase('reapply-settings');
    try {
      for (const key of PRESERVED_SETTINGS) {
        if (saved[key] !== null) await setSetting(key, saved[key]);
      }
      await fs.promises.rm(savedSettingsFile(), { force: true });
      await deps.resetCaches();
    } catch (settingsError) {
      warnings.push(`Drive settings could not be put back: ${settingsError.message}`);
    }

    if (warnings.length) {
      outcome = 'restored-with-warnings';
      error = warnings.join(' ');
    }
  } catch (unexpected) {
    outcome = 'failed';
    error = unexpected.message;
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
    // Not restored (aborted/failed): the database still has the current rows.
    if (outcome === 'failed' || outcome === 'aborted') await fs.promises.rm(savedSettingsFile(), { force: true }).catch(() => {});
    await Promise.resolve(release()).catch(() => {});
    maintenance.finish(outcome, error);
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    const line = `Restore of ${file.name} by ${user?.id || 'unknown'} finished: ${outcome} in ${seconds}s${error ? ` — ${error}` : ''}`;
    if (outcome === 'success') console.log(line);
    else console.error(line);
  }
}

// Tests and graceful callers: resolves with the final maintenance state of the running restore.
async function waitForCurrentRun() {
  if (current) await current;
  return maintenance.get();
}

module.exports = {
  PRESERVED_SETTINGS,
  buildRestoreCommands,
  filterToc,
  keepSqlLine,
  reapplySavedSettings,
  restoreFile: defaultRestoreRunner,
  savedSettingsFile,
  setRestoreDepsForTests,
  startRestore,
  waitForCurrentRun,
  writeFilteredSql
};
