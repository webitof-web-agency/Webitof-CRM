// Daily PostgreSQL backups: pg_dump → upload to <Drive backup folder>/<year>/<MM-Mon>/<YYYY-MM-DD>/ → keep the newest N.
// Each upload is checked against Drive's md5Checksum and carries its sha256 + size in appProperties
// (checked again before a restore). Retention counts daily, manual and pre-restore backups apart.
// A failed run, or no success for STALE_HOURS, alerts the settings admins (see driveConnection).
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pool } = require('../../config/db');
const { getGoogleDriveConfig, refreshDriveSettings } = require('../../config/googleDrive');
const { getSetting, setSetting } = require('../../models/systemSetting.model');
const { istParts } = require('../../utils/uploadPath');
const { FOLDER_MIME, escapeQueryValue } = require('./drive.client');
const connection = require('./driveConnection.service');

const STATE_KEY = 'google_drive_backup';
const JOB_KEY = 'job:gdrive-db-backup';
const LOCK_NAME = 'gdrive-db-backup';
const FILE_PREFIX = 'crm-backup-';
const STALE_RUNNING_MS = 60 * 60 * 1000;
// No successful backup for this long, while the schedule is on and Drive is connected, alerts admins.
const STALE_HOURS = 36;

let running = null;
// Backups a restore is using right now: retention never deletes them.
const protectedIds = new Set();

function protectFromRetention(fileId) {
  if (fileId) protectedIds.add(fileId);
  return () => protectedIds.delete(fileId);
}

function isProtectedFromRetention(fileId) {
  return protectedIds.has(fileId);
}

// md5 (what Drive reports as md5Checksum), sha256 and size, read as a stream.
function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const md5 = crypto.createHash('md5');
    const sha256 = crypto.createHash('sha256');
    let size = 0;
    fs.createReadStream(filePath)
      .on('data', (chunk) => {
        md5.update(chunk);
        sha256.update(chunk);
        size += chunk.length;
      })
      .on('error', reject)
      .on('end', () => resolve({ md5: md5.digest('hex'), sha256: sha256.digest('hex'), size }));
  });
}

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

// The kind is part of the file name, so Drive alone tells a safety copy from a daily one.
const KIND_SUFFIX = { scheduled: '', manual: '-manual', 'pre-restore': '-pre-restore' };
const OWN_TAIL = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-IST(-manual|-pre-restore)?\.dump$/;

function kindFor(trigger) {
  return trigger === 'manual' ? 'manual' : 'scheduled';
}

function buildFileName(now = new Date(), kind = 'scheduled') {
  return `${FILE_PREFIX}${databaseLabel()}-${istParts(now).stamp}-IST${KIND_SUFFIX[kind] || ''}.dump`;
}

// Only this server's own files: "crm-backup-<this database>-<date>-IST[-kind].dump".
// The date after the name keeps "crm" from matching "crm_test-…".
function isOwnBackupName(name) {
  const prefix = `${FILE_PREFIX}${databaseLabel()}-`;
  if (!String(name).startsWith(prefix)) return false;
  return OWN_TAIL.test(name.slice(prefix.length));
}

function kindOf(name) {
  if (String(name).endsWith('-pre-restore.dump')) return 'pre-restore';
  if (String(name).endsWith('-manual.dump')) return 'manual';
  return 'scheduled';
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
    // Only the app's own tables: Supabase's auth/storage/… schemas cannot be restored by this role.
    '--schema=public',
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

async function makeDump({ kind = 'scheduled' } = {}) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crm-backup-'));
  const fileName = buildFileName(new Date(), kind);
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

// Backups are filed as <backup folder>/<year>/<MM-Mon>/<YYYY-MM-DD>/<file> (India time).
// Backups from earlier layouts may sit in a month folder or directly in the backup folder;
// they are listed (and pruned) too.
const YEAR_FOLDER = /^\d{4}$/;
const MONTH_FOLDER = /^\d{2}-[A-Za-z]{3}$/;
const DAY_FOLDER = /^\d{4}-\d{2}-\d{2}$/;

async function childFolders(client, parentId, pattern) {
  const folders = await client.listFiles({
    q: `'${escapeQueryValue(parentId)}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: 'id,name'
  });
  return folders.filter((folder) => pattern.test(folder.name));
}

async function ensureChild(client, parentId, name) {
  const found = await client.findFolder(name, parentId);
  return (found || await client.createFolder(name, parentId)).id;
}

async function dayFolderFor(client, rootId, now = new Date()) {
  const { year, monthFolder, date } = istParts(now);
  const yearId = await ensureChild(client, rootId, year);
  const monthId = await ensureChild(client, yearId, monthFolder);
  return ensureChild(client, monthId, date);
}

// Every folder that can hold backups, with its parent, so emptied folders can be removed upwards.
async function backupFolders(client, rootId) {
  const folders = [{ id: rootId, parentId: null }];
  for (const year of await childFolders(client, rootId, YEAR_FOLDER)) {
    folders.push({ id: year.id, parentId: rootId, holdsFiles: false });
    for (const month of await childFolders(client, year.id, MONTH_FOLDER)) {
      folders.push({ id: month.id, parentId: year.id });
      for (const day of await childFolders(client, month.id, DAY_FOLDER)) {
        folders.push({ id: day.id, parentId: month.id });
      }
    }
  }
  return folders;
}

async function listOwnBackups(client, rootId) {
  const folders = await backupFolders(client, rootId);
  const files = [];
  for (const folder of folders) {
    if (folder.holdsFiles === false) continue;
    const inFolder = await client.listFiles({
      q: `'${escapeQueryValue(folder.id)}' in parents and trashed = false`,
      fields: 'id,name,size,createdTime,mimeType,md5Checksum,appProperties',
      orderBy: 'createdTime desc'
    });
    for (const file of inFolder) {
      if (file.mimeType !== FOLDER_MIME && isOwnBackupName(file.name)) files.push({ ...file, folderId: folder.id });
    }
  }
  files.folders = folders;
  return files.sort((a, b) => String(b.createdTime).localeCompare(String(a.createdTime)) || b.name.localeCompare(a.name));
}

async function isEmptyFolder(client, folderId) {
  const children = await client.listFiles({ q: `'${escapeQueryValue(folderId)}' in parents and trashed = false`, fields: 'id' });
  return children.length === 0;
}

function keepByKind(config = getGoogleDriveConfig()) {
  return { scheduled: config.backupKeep, manual: config.backupKeepManual, 'pre-restore': config.backupKeepPreRestore };
}

// Keeps the newest N of each kind (daily, manual, pre-restore); a backup a restore is using is never deleted.
async function applyRetention(client, rootId, keep = keepByKind()) {
  const own = await listOwnBackups(client, rootId);
  const seen = {};
  const toRemove = [];
  for (const file of own) {
    const kind = kindOf(file.name);
    seen[kind] = (seen[kind] || 0) + 1;
    if (seen[kind] > (keep[kind] ?? keep.scheduled) && !protectedIds.has(file.id)) toRemove.push(file);
  }
  for (const file of toRemove) {
    await client.deleteFile(file.id);
  }
  // Day, month and year folders emptied by the pruning go too, walking up to (not including) the root.
  const parentOf = new Map(own.folders.map((folder) => [folder.id, folder.parentId]));
  const removed = new Set();
  for (const start of new Set(toRemove.map((file) => file.folderId))) {
    let folderId = start;
    while (folderId && folderId !== rootId && !removed.has(folderId)) {
      if (!(await isEmptyFolder(client, folderId))) break;
      await client.deleteFile(folderId);
      removed.add(folderId);
      folderId = parentOf.get(folderId);
    }
  }
  return toRemove.length;
}

async function performBackup({ trigger, userId, kind }) {
  const startedAt = new Date().toISOString();
  const previous = await getSetting(STATE_KEY, {});
  await setSetting(STATE_KEY, { ...previous, state: 'RUNNING', runningSince: startedAt, last: { status: 'RUNNING', trigger, startedAt, userId } });

  let dump = null;
  try {
    const client = await connection.getClient();
    const folderId = await connection.ensureFolder('backup');
    dump = await makeDump({ kind });
    const digest = await hashFile(dump.filePath);
    // Streamed from disk in chunks; sha256 + size go with the file for the check before a restore.
    const uploaded = await client.uploadFile({
      name: dump.fileName,
      parentId: await dayFolderFor(client, folderId),
      mimeType: 'application/octet-stream',
      filePath: dump.filePath,
      description: `Webitof CRM database backup (${trigger})`,
      appProperties: { sha256: digest.sha256, size: String(digest.size) },
      fields: 'id,name,size,md5Checksum,appProperties'
    });

    // Drive computes md5Checksum from the bytes it stored: it must equal the local file's.
    const driveMd5 = uploaded.md5Checksum || (await client.getFile(uploaded.id, 'id,md5Checksum')).md5Checksum;
    if (driveMd5 !== digest.md5) {
      await client.deleteFile(uploaded.id).catch(() => {});
      throw new Error(`The uploaded backup did not match the local dump (Drive MD5 ${driveMd5 || 'missing'}, expected ${digest.md5}); it was removed from Drive.`);
    }

    let removed = 0;
    let retentionError = '';
    try {
      removed = await applyRetention(client, folderId, keepByKind());
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
      kind,
      size: dump.size,
      sha256: digest.sha256,
      verified: true,
      removed,
      ...(retentionError ? { retentionError } : {})
    };
    // A success ends any open backup alert.
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
    await setSetting(STATE_KEY, { state: 'IDLE', last: result, lastSuccess: latest.lastSuccess || null, alert: latest.alert || null });
    await recordBackupProblem({
      reason: 'failed',
      message: `The ${kind === 'scheduled' ? 'daily' : kind} database backup failed: ${error.message}`
    }).catch((alertError) => console.error('Backup failure alert could not be sent:', alertError.message));
    return result;
  } finally {
    if (dump) await dump.cleanup();
  }
}

// ─── alerts ──────────────────────────────────────────────────────────────────
// One open alert at a time in state.alert: admins hear about it at once, then once a day while it
// lasts. The next successful backup clears it (performBackup writes the state without it).
async function recordBackupProblem({ reason, message }, now = new Date()) {
  const state = await getSetting(STATE_KEY, {});
  const alert = state.alert || { since: now.toISOString() };
  const lastAlertedAt = Date.parse(alert.alertedAt || '');
  const due = !(now.getTime() - lastAlertedAt < connection.REMIND_MS);
  const next = { ...alert, reason, message, ...(due ? { alertedAt: now.toISOString() } : {}) };
  await setSetting(STATE_KEY, { ...state, alert: next });
  if (due) {
    await connection.notifyDriveAdmins({
      eventKey: reason === 'stale' ? 'gdrive_backup_overdue' : 'gdrive_backup_failed',
      title: reason === 'stale' ? 'No database backup for over a day' : 'Database backup failed',
      message: `${message} Open Settings → Storage & Backup to check, then run Back up now.`
    });
  }
  return { alerted: due, alert: next };
}

// Called with the backup cycle (server.js): alerts when the last successful backup (any kind) is
// older than STALE_HOURS while the schedule is on and Drive is connected. A freshly connected Drive
// counts from its connection time, so it is not reported as overdue right away.
async function checkBackupHealth(now = new Date()) {
  await refreshDriveSettings();
  if (getGoogleDriveConfig().backupHourIst === -1) return { checked: false, reason: 'schedule off' };
  if (!(await connection.isConnected())) return { checked: false, reason: 'drive not connected' };
  const state = await getSetting(STATE_KEY, {});
  const runningSince = Date.parse(state.runningSince || '');
  const stillRunning = state.state === 'RUNNING' && Number.isFinite(runningSince) && now.getTime() - runningSince < STALE_RUNNING_MS;
  if (running || stillRunning) return { checked: false, reason: 'backup running' };
  const driveState = await connection.getState();
  const since = Math.max(Date.parse(state.lastSuccess?.finishedAt || '') || 0, Date.parse(driveState.connectedAt || '') || 0);
  if (!since) return { checked: true, ok: true };
  const hours = (now.getTime() - since) / 3600000;
  if (hours <= STALE_HOURS) return { checked: true, ok: true, hours };
  const last = state.lastSuccess?.finishedAt ? `since ${new Date(state.lastSuccess.finishedAt).toISOString()}` : 'since Google Drive was connected';
  await recordBackupProblem({ reason: 'stale', message: `No database backup has succeeded for ${Math.floor(hours)} hours (${last}).` }, now);
  return { checked: true, ok: false, hours };
}

// Never throws; always resolves to a result object.
// lockHeld: the caller (a restore) already holds the backup lock for the whole operation.
async function runBackup({ trigger = 'manual', userId = null, kind = kindFor(trigger), lockHeld = false } = {}) {
  if (running) return { status: 'ALREADY_RUNNING' };
  running = (async () => {
    let release = null;
    try {
      if (!lockHeld) {
        release = await acquireLock();
        if (!release) return { status: 'ALREADY_RUNNING' };
      }
      return await performBackup({ trigger, userId, kind });
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

function canBackUpManually(user) {
  if (process.env.NODE_ENV !== 'production') return true;
  return Boolean(user && (user.isSuperAdmin || (Array.isArray(user.permissions) && user.permissions.includes('backups.restore'))));
}

async function getBackupStatus({ user = null } = {}) {
  const config = getGoogleDriveConfig();
  const state = await getSetting(STATE_KEY, {});
  const since = Date.parse(state.runningSince || state.last?.startedAt || '');
  const stale = Number.isFinite(since) && Date.now() - since > STALE_RUNNING_MS;
  return {
    running: Boolean(running) || (state.state === 'RUNNING' && !stale),
    // Daily backups kept; manual and pre-restore backups are counted apart.
    keep: config.backupKeep,
    keepManual: config.backupKeepManual,
    keepPreRestore: config.backupKeepPreRestore,
    alert: state.alert || null,
    schedule: {
      enabled: config.backupHourIst !== -1,
      hourIst: config.backupHourIst,
      label: scheduleLabel(config.backupHourIst)
    },
    last: state.last || null,
    lastSuccess: state.lastSuccess || null,
    manualAllowed: canBackUpManually(user)
  };
}

async function listBackups() {
  const client = await connection.getClient();
  const folderId = await connection.ensureFolder('backup');
  const files = await listOwnBackups(client, folderId);
  return files.map((file) => {
    const sha256 = file.appProperties?.sha256 || '';
    const expectedSize = Number(file.appProperties?.size || 0);
    return {
      id: file.id,
      name: file.name,
      size: Number(file.size || 0),
      createdTime: file.createdTime,
      kind: kindOf(file.name),
      sha256,
      expectedSize,
      md5Checksum: file.md5Checksum || '',
      // Checked against the local dump when it was uploaded, and Drive still holds the same size.
      verified: Boolean(sha256) && expectedSize === Number(file.size || 0)
    };
  });
}

// Before a restore: the downloaded file must match the sha256 + size saved with it, or for backups
// made before that, Drive's md5Checksum. Returns how it was checked; throws on a mismatch.
async function verifyBackupFile(file, filePath) {
  const digest = await hashFile(filePath);
  if (file.sha256) {
    if (digest.sha256 !== file.sha256 || (file.expectedSize && digest.size !== file.expectedSize)) {
      throw new Error('The downloaded backup does not match the checksum saved when it was made; it may be damaged.');
    }
    return 'sha256';
  }
  if (file.md5Checksum) {
    if (digest.md5 !== file.md5Checksum) throw new Error('The downloaded backup does not match its Drive checksum; it may be damaged.');
    return 'md5';
  }
  console.warn(`Backup ${file.name || file.id} has no checksum to verify against; restoring it unverified.`);
  return 'none';
}

// ─── backup health (read-only) ───────────────────────────────────────────────
// pg tool and server versions are cached: the Settings panel polls the status every few seconds.
const HEALTH_TTL_MS = 10 * 60 * 1000;
let healthCache = null;

function versionOf(text) {
  const match = /(\d+)(?:\.(\d+))?/.exec(String(text || ''));
  return match ? { version: match[2] !== undefined ? `${match[1]}.${match[2]}` : match[1], major: Number(match[1]) } : null;
}

function defaultToolVersion(name, toolPath) {
  return new Promise((resolve) => {
    let out = '';
    let child;
    try {
      child = spawn(toolPath, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (error) {
      resolve({ error: error.message });
      return;
    }
    const timer = setTimeout(() => child.kill('SIGTERM'), 15000);
    child.stdout.on('data', (chunk) => { out += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ error: error.code === 'ENOENT' ? `${name} was not found (${toolPath})` : error.message });
    });
    child.on('close', () => {
      clearTimeout(timer);
      const parsed = versionOf(out.split('\n')[0].replace(/^\D+/, ''));
      resolve(parsed ? { ...parsed, raw: out.split('\n')[0].trim() } : { error: `${name} did not report a version` });
    });
  });
}

async function defaultServerVersion() {
  const { query } = require('../../config/db');
  const result = await query("select current_setting('server_version') as version, current_setting('server_version_num')::int as num");
  const row = result.rows[0] || {};
  return { version: String(row.version || '').split(' ')[0], major: Math.floor(Number(row.num || 0) / 10000) };
}

let probes = { toolVersion: defaultToolVersion, serverVersion: defaultServerVersion };

function setHealthProbesForTests(overrides) {
  probes = overrides ? { toolVersion: defaultToolVersion, serverVersion: defaultServerVersion, ...overrides } : { toolVersion: defaultToolVersion, serverVersion: defaultServerVersion };
  healthCache = null;
}

// Which connection pg_dump / restore use, and whether it is Supabase's transaction pooler
// (port 6543), which cannot run a restore in one transaction.
function backupConnectionInfo() {
  const source = process.env.BACKUP_DATABASE_URL ? 'BACKUP_DATABASE_URL' : process.env.DATABASE_URL ? 'DATABASE_URL' : 'PGHOST';
  const params = getConnectionParams();
  const transactionPooler = String(params.port) === '6543';
  return {
    source,
    host: params.host,
    port: String(params.port),
    transactionPooler,
    message: transactionPooler
      ? `${source} uses port 6543 (Supabase transaction pooler). Backups work, but a restore needs the session pooler (port 5432) or the direct connection: set BACKUP_DATABASE_URL to one of those.`
      : ''
  };
}

async function versionReport() {
  if (healthCache && Date.now() - healthCache.at < HEALTH_TTL_MS) return healthCache.report;
  const toolPaths = {
    pg_dump: getGoogleDriveConfig().pgDumpPath,
    pg_restore: process.env.PG_RESTORE_PATH || 'pg_restore',
    psql: process.env.PSQL_PATH || 'psql'
  };
  let server;
  try {
    server = await probes.serverVersion();
  } catch (error) {
    server = { error: `Server version could not be read: ${error.message}` };
  }
  const tools = [];
  for (const [name, toolPath] of Object.entries(toolPaths)) {
    const found = await probes.toolVersion(name, toolPath);
    const ok = !found.error && (!server.major || found.major >= server.major);
    tools.push({
      name,
      ...found,
      ok,
      message: found.error || (ok ? '' : `${name} ${found.version} is older than the database server (${server.version}); install version ${server.major} or newer.`)
    });
  }
  const report = { server, tools, checkedAt: new Date().toISOString() };
  healthCache = { at: Date.now(), report };
  return report;
}

// Read-only summary for Settings → Storage & Backup: nothing here changes the server or database.
async function getBackupHealth(now = new Date()) {
  const config = getGoogleDriveConfig();
  const state = await getSetting(STATE_KEY, {});
  const driveStatus = await connection.getState().catch(() => ({}));
  const connected = Boolean(driveStatus.encryptedRefreshToken) && !driveStatus.needsReconnect;
  const lastSuccessAt = state.lastSuccess?.finishedAt || null;
  const hoursSinceSuccess = lastSuccessAt ? Math.floor((now.getTime() - Date.parse(lastSuccessAt)) / 3600000) : null;
  const scheduleOn = config.backupHourIst !== -1;
  const { server, tools, checkedAt } = await versionReport();
  const connectionInfo = backupConnectionInfo();
  const overdue = scheduleOn && connected && hoursSinceSuccess !== null && hoursSinceSuccess > STALE_HOURS;

  const problems = [];
  if (!connected) problems.push(driveStatus.needsReconnect ? 'Google Drive needs to be reconnected.' : 'Google Drive is not connected.');
  if (!scheduleOn) problems.push('The daily backup schedule is off.');
  if (server.error) problems.push(server.error);
  for (const tool of tools) if (!tool.ok) problems.push(tool.message);
  if (connectionInfo.transactionPooler) problems.push(connectionInfo.message);
  if (overdue) problems.push(`No successful backup for ${hoursSinceSuccess} hours.`);
  else if (scheduleOn && connected && !lastSuccessAt) problems.push('No backup has succeeded yet.');

  return {
    ok: problems.length === 0,
    problems,
    checkedAt,
    server,
    tools,
    connection: connectionInfo,
    schedule: { enabled: scheduleOn, label: scheduleLabel(config.backupHourIst) },
    lastSuccessAt,
    hoursSinceSuccess,
    overdue,
    staleAfterHours: STALE_HOURS,
    drive: { connected, needsReconnect: Boolean(driveStatus.needsReconnect) },
    alert: state.alert || null
  };
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
  STALE_HOURS,
  backupConnectionInfo,
  buildFileName,
  canBackUpManually,
  checkBackupHealth,
  getBackupHealth,
  getConnectionParams,
  hashFile,
  isProtectedFromRetention,
  kindOf,
  protectFromRetention,
  recordBackupProblem,
  redact,
  getBackupStatus,
  isOwnBackupName,
  listBackups,
  makeDump,
  openBackup,
  runBackup,
  runScheduledBackupIfDue,
  setDumpRunnerForTests,
  setHealthProbesForTests,
  acquireBackupLock: () => acquireLock(),
  setLockForTests,
  startBackupInBackground,
  verifyBackupFile
};
