const { hasEncryptionKey } = require('../utils/encryption');
const { getSetting } = require('../models/systemSetting.model');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DEFAULT_BACKUP_FOLDER_NAME = 'Webitof Backups';
const DEFAULT_UPLOADS_FOLDER_NAME = 'Webitof Uploads';
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
  uploadsFolderName: { env: ['GDRIVE_UPLOADS_FOLDER_NAME'], label: 'Uploads folder name', envOnly: true },
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

function parseKeep(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_BACKUP_KEEP;
  return Math.min(parsed, 100);
}

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

// Connected the same way as the JCB Exchange project: client id + secret + a refresh token made in
// the OAuth 2.0 Playground. There is no Google sign-in redirect through this app.
function getGoogleDriveConfig() {
  return {
    clientId: raw('clientId'),
    clientSecret: raw('clientSecret'),
    // Applied once per value (see connectFromEnvToken), whether it comes from settings or env.
    envRefreshToken: raw('refreshToken'),
    parentFolderId: parseFolderId(raw('parentFolderId')),
    backupFolderName: raw('backupFolderName') || DEFAULT_BACKUP_FOLDER_NAME,
    uploadsFolderName: raw('uploadsFolderName') || DEFAULT_UPLOADS_FOLDER_NAME,
    backupKeep: parseKeep(raw('backupKeep')),
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
