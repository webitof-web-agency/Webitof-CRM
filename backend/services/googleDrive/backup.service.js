// Daily PostgreSQL backups: pg_dump → upload to the Drive backup folder → keep the newest N.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pool } = require('../../config/db');
const { getGoogleDriveConfig, refreshDriveSettings } = require('../../config/googleDrive');
const { getSetting, setSetting } = require('../../models/systemSetting.model');
const { istParts } = require('../../utils/uploadPath');
const { escapeQueryValue } = require('./drive.client');
const connection = require('./driveConnection.service');

const STATE_KEY = 'google_drive_backup';
const JOB_KEY = 'job:gdrive-db-backup';
const LOCK_NAME = 'gdrive-db-backup';
const FILE_PREFIX = 'crm-backup-';
const STALE_RUNNING_MS = 60 * 60 * 1000;

let running = null;

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

function getConnectionParams() {
  const url = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '')) || 'postgres',
      sslmode: parsed.searchParams.get('sslmode') || ''
    };
  }
  return {
    host: process.env.PGHOST || 'localhost',
    port: String(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'webitof_crm',
    sslmode: ''
  };
}

function databaseLabel() {
  return getConnectionParams().database.replace(/[^A-Za-z0-9_-]+/g, '-') || 'db';
}

function buildFileName(now = new Date()) {
  return `${FILE_PREFIX}${databaseLabel()}-${istParts(now).stamp}-IST.dump`;
}

// Only this server's own files: "crm-backup-<this database>-<date>…dump".
// The date after the name keeps "crm" from matching "crm_test-…".
function isOwnBackupName(name) {
  const prefix = `${FILE_PREFIX}${databaseLabel()}-`;
  if (!/^crm-backup-.+\.dump$/.test(name) || !name.startsWith(prefix)) return false;
  return /^\d{4}-\d{2}-\d{2}_/.test(name.slice(prefix.length));
}

function redact(text, secret) {
  let output = String(text || '');
  if (secret) output = output.split(secret).join('***');
  return output;
}

function defaultDumpRunner(filePath) {
  const params = getConnectionParams();
  const config = getGoogleDriveConfig();
  const childEnv = { ...process.env, PGPASSWORD: params.password };
  delete childEnv.DATABASE_URL;
  delete childEnv.BACKUP_DATABASE_URL;
  if (params.sslmode) childEnv.PGSSLMODE = params.sslmode;
  else if (String(process.env.DB_SSL || '').toLowerCase() === 'true') childEnv.PGSSLMODE = 'require';

  const args = [
    '--format=custom',
    '--compress=6',
    '--no-owner',
    '--no-privileges',
    `--host=${params.host}`,
    `--port=${params.port}`,
    `--username=${params.user}`,
    `--dbname=${params.database}`,
    `--file=${filePath}`
  ];

  return new Promise((resolve, reject) => {
    let stderr = '';
    const child = spawn(config.pgDumpPath, args, { env: childEnv, stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });
    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error('pg_dump was not found. Install the PostgreSQL client tools or set PG_DUMP_PATH.'));
      } else {
        reject(new Error(redact(error.message, params.password)));
      }
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump exited with code ${code}: ${redact(stderr.slice(-2000), params.password).trim()}`));
    });
  });
}

let dumpRunner = defaultDumpRunner;

function setDumpRunnerForTests(fn) {
  dumpRunner = fn || defaultDumpRunner;
}

// Cross-process lock so two servers (or a restart mid-run) never back up at once.
async function defaultAcquireLock() {
  const client = await pool.connect();
  try {
    const result = await client.query('select pg_try_advisory_lock(hashtext($1)) as locked', [LOCK_NAME]);
    if (!result.rows[0]?.locked) {
      client.release();
      return null;
    }
  } catch (error) {
    client.release();
    throw error;
  }
  return async () => {
    try {
      await client.query('select pg_advisory_unlock(hashtext($1))', [LOCK_NAME]);
    } finally {
      client.release();
    }
  };
}

let acquireLock = defaultAcquireLock;

function setLockForTests(fn) {
  acquireLock = fn || defaultAcquireLock;
}

async function makeDump() {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crm-backup-'));
  const fileName = buildFileName();
  const filePath = path.join(dir, fileName);
  const cleanup = () => fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  try {
    await dumpRunner(filePath);
    const stat = await fs.promises.stat(filePath);
    if (!stat.size) throw new Error('pg_dump produced an empty file');
    return { dir, fileName, filePath, size: stat.size, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function listOwnBackups(client, folderId) {
  const files = await client.listFiles({
    q: `'${escapeQueryValue(folderId)}' in parents and trashed = false`,
    fields: 'id,name,size,createdTime',
    orderBy: 'createdTime desc'
  });
  return files
    .filter((file) => isOwnBackupName(file.name))
    .sort((a, b) => String(b.createdTime).localeCompare(String(a.createdTime)) || b.name.localeCompare(a.name));
}

async function applyRetention(client, folderId, keep) {
  const own = await listOwnBackups(client, folderId);
  const toRemove = own.slice(keep);
  for (const file of toRemove) {
    await client.deleteFile(file.id);
  }
  return toRemove.length;
}

async function performBackup({ trigger, userId }) {
  const startedAt = new Date().toISOString();
  const previous = await getSetting(STATE_KEY, {});
  await setSetting(STATE_KEY, { ...previous, state: 'RUNNING', runningSince: startedAt, last: { status: 'RUNNING', trigger, startedAt, userId } });

  let dump = null;
  try {
    const client = await connection.getClient();
    const folderId = await connection.ensureFolder('backup');
    dump = await makeDump();
    const buffer = await fs.promises.readFile(dump.filePath);
    const uploaded = await client.uploadFile({
      name: dump.fileName,
      parentId: folderId,
      mimeType: 'application/octet-stream',
      buffer,
      description: `Webitof CRM database backup (${trigger})`
    });

    let removed = 0;
    let retentionError = '';
    try {
      removed = await applyRetention(client, folderId, getGoogleDriveConfig().backupKeep);
    } catch (error) {
      // The new backup is already safe; record the problem without failing the run.
      retentionError = error.message;
    }

    const result = {
      status: 'SUCCESS',
      trigger,
      startedAt,
      finishedAt: new Date().toISOString(),
      fileId: uploaded.id,
      fileName: dump.fileName,
      size: dump.size,
      removed,
      ...(retentionError ? { retentionError } : {})
    };
    await setSetting(STATE_KEY, { state: 'IDLE', last: result, lastSuccess: result });
    return result;
  } catch (error) {
    const result = {
      status: 'FAILED',
      trigger,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error.message
    };
    const latest = await getSetting(STATE_KEY, {});
    await setSetting(STATE_KEY, { state: 'IDLE', last: result, lastSuccess: latest.lastSuccess || null });
    return result;
  } finally {
    if (dump) await dump.cleanup();
  }
}

// Never throws; always resolves to a result object.
async function runBackup({ trigger = 'manual', userId = null } = {}) {
  if (running) return { status: 'ALREADY_RUNNING' };
  running = (async () => {
    let release = null;
    try {
      release = await acquireLock();
      if (!release) return { status: 'ALREADY_RUNNING' };
      return await performBackup({ trigger, userId });
    } catch (error) {
      return { status: 'FAILED', trigger, error: error.message };
    } finally {
      if (release) await release().catch(() => {});
    }
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}

function startBackupInBackground(options) {
  if (running) return false;
  void runBackup(options).then((result) => {
    if (result.status === 'FAILED') console.error('Database backup failed:', result.error);
  });
  return true;
}

// Once per India date, at or after the configured hour. The date is recorded before
// running, so a failing backup is not retried every cycle; an admin can retry by hand.
async function runScheduledBackupIfDue(now = new Date()) {
  await refreshDriveSettings();
  const { backupHourIst } = getGoogleDriveConfig();
  if (backupHourIst === -1) return { status: 'SKIPPED', reason: 'schedule off' };
  const { date, hour } = istParts(now);
  if (hour < backupHourIst) return { status: 'SKIPPED', reason: 'before hour' };
  const job = await getSetting(JOB_KEY, {});
  if (job.lastRunLabel === date) return { status: 'SKIPPED', reason: 'already ran today' };
  await connection.connectFromEnvToken();
  if (!(await connection.isConnected())) return { status: 'SKIPPED', reason: 'drive not connected' };

  await setSetting(JOB_KEY, { lastRunLabel: date });
  return runBackup({ trigger: 'schedule' });
}

function scheduleLabel(hour) {
  if (hour === -1) return 'Manual only';
  return `Daily at ${String(hour).padStart(2, '0')}:00 IST`;
}

async function getBackupStatus() {
  const config = getGoogleDriveConfig();
  const state = await getSetting(STATE_KEY, {});
  const since = Date.parse(state.runningSince || state.last?.startedAt || '');
  const stale = Number.isFinite(since) && Date.now() - since > STALE_RUNNING_MS;
  return {
    running: Boolean(running) || (state.state === 'RUNNING' && !stale),
    keep: config.backupKeep,
    schedule: {
      enabled: config.backupHourIst !== -1,
      hourIst: config.backupHourIst,
      label: scheduleLabel(config.backupHourIst)
    },
    last: state.last || null,
    lastSuccess: state.lastSuccess || null,
    manualAllowed: process.env.NODE_ENV !== 'production'
  };
}

async function listBackups() {
  const client = await connection.getClient();
  const folderId = await connection.ensureFolder('backup');
  const files = await listOwnBackups(client, folderId);
  return files.map((file) => ({
    id: file.id,
    name: file.name,
    size: Number(file.size || 0),
    createdTime: file.createdTime
  }));
}

// Only ids in this server's own backup list, so this never becomes a "read any Drive file" proxy.
async function openBackup(fileId) {
  const backups = await listBackups();
  const match = backups.find((file) => file.id === fileId);
  if (!match) throw httpError('Backup not found', 404);
  const client = await connection.getClient();
  const response = await client.download(fileId);
  return { file: match, response };
}

module.exports = {
  buildFileName,
  getBackupStatus,
  isOwnBackupName,
  listBackups,
  makeDump,
  openBackup,
  runBackup,
  runScheduledBackupIfDue,
  setDumpRunnerForTests,
  setLockForTests,
  startBackupInBackground
};
