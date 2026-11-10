// Google Drive settings for Settings → Storage & Backup.
// The Google credentials and the folders come from the server env only (FIELDS[...].envOnly): the
// browser sees which env vars are set (never a secret value) and cannot change them. Only the
// backup schedule can be saved here, and a saved value wins over its env var.
const {
  FIELDS,
  SETTINGS_KEY,
  envNameOf,
  getGoogleDriveConfig,
  getGoogleDriveConfigProblems,
  refreshDriveSettings,
  sourceOf
} = require('../../config/googleDrive');
const { getSetting, setSetting } = require('../../models/systemSetting.model');
const connection = require('./driveConnection.service');

const EDITABLE_FIELDS = Object.keys(FIELDS).filter((field) => !FIELDS[field].envOnly);

const ENV_ONLY = [
  { name: 'SETTINGS_ENCRYPTION_KEY', reason: 'Encrypts the Drive token kept in the database. Same value on every server that uses this database; never change it.' },
  { name: 'PG_DUMP_PATH', reason: 'A program the server runs; never set from the browser.' },
  { name: 'BACKUP_DATABASE_URL', reason: 'Database credentials for pg_dump stay on the server.' }
];

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

function isSet(field) {
  return FIELDS[field].env.some((name) => String(process.env[name] || '').trim());
}

async function getConfigView() {
  await refreshDriveSettings({ force: true });
  const config = getGoogleDriveConfig();
  const sources = Object.fromEntries(Object.keys(FIELDS).map((field) => [field, sourceOf(field)]));
  return {
    // Read-only in the browser. Secrets are reported as set / not set only.
    env: [
      { key: 'clientId', name: envNameOf('clientId'), label: FIELDS.clientId.label, set: isSet('clientId'), value: config.clientId },
      { key: 'clientSecret', name: envNameOf('clientSecret'), label: FIELDS.clientSecret.label, set: isSet('clientSecret'), secret: true },
      { key: 'refreshToken', name: envNameOf('refreshToken'), label: FIELDS.refreshToken.label, set: isSet('refreshToken'), secret: true },
      { key: 'parentFolderId', name: envNameOf('parentFolderId'), label: FIELDS.parentFolderId.label, set: isSet('parentFolderId'), value: config.parentFolderId, emptyMeans: 'My Drive (root)' },
      { key: 'uploadsFolderName', name: envNameOf('uploadsFolderName'), label: FIELDS.uploadsFolderName.label, set: isSet('uploadsFolderName'), value: config.uploadsFolderName },
      { key: 'backupFolderName', name: envNameOf('backupFolderName'), label: FIELDS.backupFolderName.label, set: isSet('backupFolderName'), value: config.backupFolderName }
    ],
    values: {
      backupKeep: config.backupKeep,
      backupHourIst: config.backupHourIst
    },
    sources: Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, sources[field]])),
    problems: getGoogleDriveConfigProblems(config),
    envOnly: ENV_ONLY.map((item) => ({ ...item, set: Boolean(String(process.env[item.name] || '').trim()) }))
  };
}

// Field rules: '' clears the saved value (falls back to env/default); undefined leaves it unchanged.
function normalizeField(field, value) {
  if (value === '' || value === null) return '';
  switch (field) {
    case 'backupKeep': {
      const keep = Number.parseInt(value, 10);
      if (!Number.isFinite(keep) || keep < 1 || keep > 100) throw httpError('Backups to keep must be between 1 and 100');
      return keep;
    }
    case 'backupHourIst': {
      const hour = Number.parseInt(value, 10);
      if (!Number.isFinite(hour) || hour < -1 || hour > 23) throw httpError('Backup hour must be 0–23, or off');
      return hour;
    }
    default:
      throw httpError(`${FIELDS[field].label} cannot be changed here`);
  }
}

async function saveConfig(patch = {}) {
  const given = (field) => Object.prototype.hasOwnProperty.call(patch, field) && patch[field] !== undefined;

  const envOnly = Object.keys(FIELDS).filter((field) => FIELDS[field].envOnly && given(field));
  if (envOnly.length) {
    const names = envOnly.map((field) => FIELDS[field].env[0]).join(', ');
    throw httpError(`Google Drive credentials and folders are set in the server env only (${names}).`, 400);
  }

  const stored = await getSetting(SETTINGS_KEY, {});
  // Drops credentials or folders saved by older versions, so nothing secret lingers in the database.
  const next = Object.fromEntries(Object.entries(stored).filter(([field]) => !FIELDS[field]?.envOnly));

  for (const field of EDITABLE_FIELDS) {
    if (!given(field)) continue;
    const value = normalizeField(field, patch[field]);
    if (value === '') delete next[field];
    else next[field] = value;
  }

  await setSetting(SETTINGS_KEY, next);
  await refreshDriveSettings({ force: true });
  connection.resetCache();
  return getConfigView();
}

module.exports = {
  getConfigView,
  saveConfig
};
