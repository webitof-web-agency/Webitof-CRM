// Google Drive settings edited from Settings → Storage & Backup. Saved values win over env vars;
// secrets are stored encrypted and never sent back to the browser.
const {
  FIELDS,
  SETTINGS_KEY,
  getGoogleDriveConfig,
  getGoogleDriveConfigProblems,
  parseFolderId,
  refreshDriveSettings,
  sourceOf
} = require('../../config/googleDrive');
const { encrypt, hasEncryptionKey } = require('../../utils/encryption');
const { getSetting, setSetting } = require('../../models/systemSetting.model');
const connection = require('./driveConnection.service');

const ENV_ONLY = [
  { name: 'SETTINGS_ENCRYPTION_KEY', reason: 'Encrypts the secrets saved here, so it cannot be stored with them.' },
  { name: 'JWT_SECRET', reason: 'Signs logins and the Google sign-in state.' },
  { name: 'FRONTEND_URL', reason: 'Where Google sends the browser back after sign-in.' },
  { name: 'PG_DUMP_PATH', reason: 'A program the server runs; never set from the browser.' },
  { name: 'BACKUP_DATABASE_URL', reason: 'Database credentials for pg_dump stay on the server.' }
];

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

async function getConfigView() {
  await refreshDriveSettings({ force: true });
  const config = getGoogleDriveConfig();
  const sources = Object.fromEntries(Object.keys(FIELDS).map((field) => [field, sourceOf(field)]));
  return {
    values: {
      clientId: config.clientId,
      clientSecretSet: Boolean(config.clientSecret),
      redirectUri: config.redirectUri,
      defaultRedirectUri: config.defaultRedirectUri,
      refreshTokenSet: Boolean(config.envRefreshToken),
      parentFolderId: config.parentFolderId,
      uploadsFolderName: config.uploadsFolderName,
      backupFolderName: config.backupFolderName,
      backupKeep: config.backupKeep,
      backupHourIst: config.backupHourIst
    },
    sources,
    canStoreSecrets: hasEncryptionKey(),
    problems: getGoogleDriveConfigProblems(config),
    envOnly: ENV_ONLY.map((item) => ({ ...item, set: Boolean(String(process.env[item.name] || '').trim()) }))
  };
}

function cleanText(value, label, max = 500) {
  const text = String(value ?? '').trim();
  if (text.length > max) throw httpError(`${label} is too long`);
  if (/[\u0000-\u001f\u007f]/.test(text)) throw httpError(`${label} contains invalid characters`);
  return text;
}

// Field rules: '' clears the saved value (falls back to env/default); undefined leaves it unchanged.
function normalizeField(field, value) {
  const label = FIELDS[field].label;
  if (value === '' || value === null) return '';
  switch (field) {
    case 'redirectUri': {
      const text = cleanText(value, label);
      let url;
      try {
        url = new URL(text);
      } catch {
        throw httpError('Redirect URI must be a full URL, e.g. https://crmapi.example.com/api/google-drive/oauth/callback');
      }
      if (!['http:', 'https:'].includes(url.protocol)) throw httpError('Redirect URI must start with http:// or https://');
      if (!url.pathname.endsWith('/google-drive/oauth/callback')) {
        throw httpError('Redirect URI must end with /google-drive/oauth/callback');
      }
      return text;
    }
    case 'parentFolderId': {
      const id = parseFolderId(value);
      if (!id) throw httpError('Parent folder must be a Google Drive folder id or folder link');
      return id;
    }
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
    case 'uploadsFolderName':
    case 'backupFolderName': {
      const name = cleanText(value, label, 200);
      if (/[/\\]/.test(name)) throw httpError(`${label} cannot contain slashes`);
      return name;
    }
    default:
      return cleanText(value, label, 2000);
  }
}

async function saveConfig(patch = {}) {
  const before = getGoogleDriveConfig();
  const stored = await getSetting(SETTINGS_KEY, {});
  const next = { ...stored };

  for (const [field, definition] of Object.entries(FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(patch, field) || patch[field] === undefined) continue;
    const value = normalizeField(field, patch[field]);
    if (value === '') {
      delete next[field];
    } else if (definition.secret) {
      if (!hasEncryptionKey()) {
        throw httpError('Set SETTINGS_ENCRYPTION_KEY on the server before saving secrets here.', 409);
      }
      next[field] = encrypt(String(value));
    } else {
      next[field] = value;
    }
  }

  await setSetting(SETTINGS_KEY, next);
  await refreshDriveSettings({ force: true });
  const after = getGoogleDriveConfig();

  // A refresh token belongs to the OAuth client that issued it.
  if (before.clientId && after.clientId !== before.clientId) {
    await connection.markNeedsReconnect();
  }
  connection.resetCache();
  return getConfigView();
}

module.exports = {
  getConfigView,
  saveConfig
};
