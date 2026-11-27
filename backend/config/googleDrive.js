const { hasEncryptionKey } = require('../utils/encryption');
const { getSetting } = require('../models/systemSetting.model');

// Full Drive scope: the parent folder (GDRIVE_PARENT_FOLDER_ID) is made by hand in Drive, and the
// narrower drive.file scope only sees folders this app created itself.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
// Everything the ERP keeps in Drive sits in one main folder (inside GDRIVE_PARENT_FOLDER_ID):
//   Webitof ERP Data/01 CRM ... 07 General   uploads (utils/uploadPath.js)
//   Webitof ERP Data/99 Backups/Database/... daily database backups
const DEFAULT_ROOT_FOLDER_NAME = 'Webitof ERP Data';
const DEFAULT_BACKUP_FOLDER_NAME = '99 Backups';
const BACKUP_DATABASE_FOLDER_NAME = 'Database';
const DEFAULT_BACKUP_KEEP = 15;
const DEFAULT_BACKUP_HOUR_IST = 2;
const SETTINGS_KEY = 'google_drive_config';
const REFRESH_TTL_MS = 10_000;

// Drive settings. `envOnly` ones (the Google credentials and the folders) come from the server env
// alone: an admin cannot set or override them from the browser, and values saved there by older
// versions are ignored. The others can be changed in Settings → Storage & Backup, where a saved
// value wins over the env var.
const FIELDS = {
  clientId: { env: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_ID'], label: 'Client ID', envOnly: true },
  clientSecret: { env: ['GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_DRIVE_CLIENT_SECRET'], label: 'Client secret', secret: true, envOnly: true },
  refreshToken: { env: ['GOOGLE_OAUTH_REFRESH_TOKEN', 'GOOGLE_DRIVE_REFRESH_TOKEN'], label: 'Refresh token', secret: true, envOnly: true },
  parentFolderId: { env: ['GDRIVE_PARENT_FOLDER_ID'], label: 'Parent folder', envOnly: true },
  rootFolderName: { env: ['GDRIVE_ROOT_FOLDER_NAME'], label: 'Main folder name', envOnly: true },
  backupFolderName: { env: ['GDRIVE_BACKUP_FOLDER_NAME'], label: 'Backup folder name', envOnly: true },
  backupKeep: { env: ['GDRIVE_BACKUP_KEEP'], label: 'Backups to keep' },
  backupHourIst: { env: ['GDRIVE_BACKUP_HOUR_IST'], label: 'Backup hour' }
};

// Values saved in Settings (never the envOnly fields). Refreshed from the DB on a short TTL so
// getGoogleDriveConfig() can stay synchronous.
let saved = {};
let refreshedAt = 0;
let refreshing = null;

function env(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

// Accepts a bare folder id or a https://drive.google.com/drive/folders/<id> link.
function parseFolderId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/\/folders\/([A-Za-z0-9_-]+)/) || raw.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  return /^[A-Za-z0-9_-]+$/.test(raw) ? raw : '';
}

function parseKeep(value, fallback = DEFAULT_BACKUP_KEEP) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 100);
}

// Manual ("Back up now") and pre-restore safety backups are kept apart from the daily ones, so
// clicking Back up now never pushes daily backups out. Server env only.
const DEFAULT_KEEP_MANUAL = 5;
const DEFAULT_KEEP_PRE_RESTORE = 5;

function parseHour(value) {
  if (value === '' || value == null) return DEFAULT_BACKUP_HOUR_IST;
  const parsed = Number.parseInt(value, 10);
  if (parsed === -1) return -1;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 23) return DEFAULT_BACKUP_HOUR_IST;
  return parsed;
}

function getFrontendBaseUrl() {
  const first = env('FRONTEND_URL').split(',').map((item) => item.trim()).find(Boolean) || '';
  return first.replace(/\/+$/, '');
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function savedValue(field) {
  return !FIELDS[field].envOnly && hasValue(saved[field]) ? String(saved[field]).trim() : '';
}

// Where each field's value comes from: 'settings', 'environment' or 'default'.
function sourceOf(field) {
  if (savedValue(field)) return 'settings';
  return env(...FIELDS[field].env) ? 'environment' : 'default';
}

// The env var that holds the field: the first one that is set, else the preferred name.
function envNameOf(field) {
  const names = FIELDS[field].env;
  return names.find((name) => String(process.env[name] || '').trim()) || names[0];
}

function raw(field) {
  return savedValue(field) || env(...FIELDS[field].env);
}

async function refreshDriveSettings({ force = false } = {}) {
  if (!force && Date.now() - refreshedAt < REFRESH_TTL_MS) return;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const stored = await getSetting(SETTINGS_KEY, {});
        const next = {};
        for (const [field, definition] of Object.entries(FIELDS)) {
          if (!definition.envOnly && hasValue(stored[field])) next[field] = stored[field];
        }
        saved = next;
        refreshedAt = Date.now();
      } catch (error) {
        // Table missing before the first migration, or DB unreachable: keep the last known values.
        console.error('Google Drive settings could not be loaded:', error.message);
      } finally {
        refreshing = null;
      }
    })();
  }
  await refreshing;
}

// Client id + secret come from the env. The refresh token is made by an admin with the
// "Connect Google Drive" button (Google sign-in) and kept encrypted in the database; a token in
// GOOGLE_OAUTH_REFRESH_TOKEN (OAuth Playground) still works as a fallback.
function getGoogleDriveConfig() {
  return {
    clientId: raw('clientId'),
    clientSecret: raw('clientSecret'),
    // Applied once per value (see connectFromEnvToken), whether it comes from settings or env.
    envRefreshToken: raw('refreshToken'),
    // Only this Google account may be connected (empty = any account).
    allowedEmail: env('GDRIVE_ALLOWED_EMAIL').toLowerCase(),
    // Where Google sends the browser back after sign-in; empty = built from the API request.
    // Must be listed under "Authorized redirect URIs" of the OAuth client.
    redirectUri: env('GOOGLE_OAUTH_REDIRECT_URI'),
    parentFolderId: parseFolderId(raw('parentFolderId')),
    rootFolderName: raw('rootFolderName') || DEFAULT_ROOT_FOLDER_NAME,
    backupFolderName: raw('backupFolderName') || DEFAULT_BACKUP_FOLDER_NAME,
    backupDatabaseFolderName: BACKUP_DATABASE_FOLDER_NAME,
    // Scheduled (daily) backups kept; manual and pre-restore ones have their own limits.
    backupKeep: parseKeep(raw('backupKeep')),
    backupKeepManual: parseKeep(env('GDRIVE_BACKUP_KEEP_MANUAL'), DEFAULT_KEEP_MANUAL),
    backupKeepPreRestore: parseKeep(env('GDRIVE_BACKUP_KEEP_PRE_RESTORE'), DEFAULT_KEEP_PRE_RESTORE),
    backupHourIst: parseHour(raw('backupHourIst')),
    // Server-only: a path to run or a database to dump is never taken from the browser.
    pgDumpPath: env('PG_DUMP_PATH') || 'pg_dump',
    frontendUrl: getFrontendBaseUrl(),
    scope: DRIVE_SCOPE
  };
}

// Names only, never values.
function getGoogleDriveConfigProblems(config = getGoogleDriveConfig()) {
  const problems = [];
  if (!config.clientId) problems.push('Client ID is not set (GOOGLE_OAUTH_CLIENT_ID in the server env)');
  if (!config.clientSecret) problems.push('Client secret is not set (GOOGLE_OAUTH_CLIENT_SECRET in the server env)');
  if (!hasEncryptionKey()) problems.push('SETTINGS_ENCRYPTION_KEY is not set on the server (64 hex characters)');
  if (raw('parentFolderId') && !config.parentFolderId) problems.push('GDRIVE_PARENT_FOLDER_ID is not a folder id or link');
  return problems;
}

function _resetDriveSettingsForTests() {
  saved = {};
  refreshedAt = 0;
}

module.exports = {
  _resetDriveSettingsForTests,
  DRIVE_SCOPE,
  FIELDS,
  SETTINGS_KEY,
  getGoogleDriveConfig,
  getGoogleDriveConfigProblems,
  envNameOf,
  parseFolderId,
  parseHour,
  parseKeep,
  refreshDriveSettings,
  sourceOf
};
