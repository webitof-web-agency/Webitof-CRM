// The single connected Google account: OAuth state, encrypted refresh token, folders.
const jwt = require('jsonwebtoken');
const { query } = require('../../config/db');
const { getGoogleDriveConfig, getGoogleDriveConfigProblems, refreshDriveSettings } = require('../../config/googleDrive');
const { decrypt, encrypt, sha256 } = require('../../utils/encryption');
const { getSetting, setSetting } = require('../../models/systemSetting.model');
const { DriveClient, DriveError, buildAuthUrl, exchangeCode, revokeToken } = require('./drive.client');

const SETTINGS_KEY = 'google_drive';
const STATE_PURPOSE = 'gdrive-connect';
const FOLDER_KINDS = {
  backup: { idKey: 'backupFolderId', nameKey: 'backupFolderName', configKey: 'backupFolderName' },
  uploads: { idKey: 'uploadsFolderId', nameKey: 'uploadsFolderName', configKey: 'uploadsFolderName' }
};

let cachedClient = null;
let cachedClientKey = '';
let envConnectPromise = null;

let countDriveFiles = async () => {
  const result = await query(`select count(*)::int as count from file_assets where storage_provider = 'gdrive'`);
  return Number(result.rows[0]?.count || 0);
};

function setDriveFileCounterForTests(fn) {
  countDriveFiles = fn;
}

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

async function getState() {
  return getSetting(SETTINGS_KEY, {});
}

async function saveState(state) {
  await setSetting(SETTINGS_KEY, state);
  return state;
}

function folderLink(folderId) {
  return folderId ? `https://drive.google.com/drive/folders/${folderId}` : '';
}

function clearClientCache() {
  cachedClient = null;
  cachedClientKey = '';
}

// Drops the cached client so changed settings (client id/secret) take effect.
function resetCache() {
  clearClientCache();
  envConnectPromise = null;
}

async function markNeedsReconnect() {
  const state = await getState();
  if (!state.encryptedRefreshToken) return;
  await saveState({ ...state, needsReconnect: true });
  clearClientCache();
}

function assertConfigured() {
  const problems = getGoogleDriveConfigProblems();
  if (problems.length) {
    throw httpError(`Google Drive is not configured: ${problems.join('; ')}`, 400);
  }
  return getGoogleDriveConfig();
}

function createConnectState(userId) {
  return jwt.sign({ purpose: STATE_PURPOSE, uid: userId }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '10m'
  });
}

function verifyConnectState(state) {
  try {
    const decoded = jwt.verify(String(state || ''), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.purpose !== STATE_PURPOSE) throw new Error('wrong purpose');
    return decoded;
  } catch {
    throw httpError('The Google sign-in link expired or is invalid. Start the connection again.', 400);
  }
}

async function getAuthUrl(userId) {
  await refreshDriveSettings();
  const config = assertConfigured();
  return buildAuthUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scope: config.scope,
    state: createConnectState(userId)
  });
}

function clientFor(state) {
  const config = getGoogleDriveConfig();
  const key = state.encryptedRefreshToken?.ciphertext || '';
  if (cachedClient && cachedClientKey === key) return cachedClient;

  let refreshToken;
  try {
    refreshToken = decrypt(state.encryptedRefreshToken);
  } catch {
    // Key changed, or the DB came from another environment.
    void markNeedsReconnect();
    throw httpError('Stored Google Drive credentials could not be decrypted. Reconnect Google Drive in Settings.', 409);
  }

  cachedClient = new DriveClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken,
    onInvalidGrant: markNeedsReconnect
  });
  cachedClientKey = key;
  return cachedClient;
}

async function folderUsable(client, folderId, parentId) {
  try {
    const file = await client.getFile(folderId, 'id,trashed,parents,mimeType');
    if (file.trashed) return false;
    if (parentId && !(file.parents || []).includes(parentId)) return false;
    return true;
  } catch (error) {
    if (error instanceof DriveError && (error.statusCode === 404 || error.statusCode === 403)) return false;
    throw error;
  }
}

async function ensureFolder(kind, { client = null } = {}) {
  const definition = FOLDER_KINDS[kind];
  if (!definition) throw new Error(`Unknown folder kind: ${kind}`);
  const config = getGoogleDriveConfig();
  const state = await getState();
  const driveClient = client || clientFor(state);
  const parentId = config.parentFolderId;
  const name = config[definition.configKey];

  const storedId = state[definition.idKey];
  if (storedId && await folderUsable(driveClient, storedId, parentId)) {
    // The folder name was changed in settings: rename the existing folder in place.
    if (state[definition.nameKey] && state[definition.nameKey] !== name) {
      try {
        await driveClient.updateFile(storedId, { name });
        await saveState({ ...(await getState()), [definition.nameKey]: name });
      } catch (error) {
        console.error(`Google Drive ${kind} folder could not be renamed:`, error.message);
      }
    }
    return storedId;
  }

  let folder = null;
  if (parentId) {
    try {
      folder = await driveClient.findFolder(name, parentId);
    } catch (error) {
      if (error instanceof DriveError && (error.statusCode === 404 || error.statusCode === 403)) {
        throw httpError(
          'GDRIVE_PARENT_FOLDER_ID could not be opened. Check the id, and note that the drive.file scope only sees folders this app created.',
          400
        );
      }
      throw error;
    }
  }
  if (!folder) folder = await driveClient.createFolder(name, parentId || null);

  const latest = await getState();
  await saveState({ ...latest, [definition.idKey]: folder.id, [definition.nameKey]: name });
  return folder.id;
}

async function saveConnection(refreshToken, { userId = null, source = 'oauth' } = {}) {
  const config = getGoogleDriveConfig();
  const encryptedRefreshToken = encrypt(refreshToken);
  const client = new DriveClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken
  });

  let account;
  try {
    account = await client.about();
  } catch (error) {
    if (source === 'oauth') await revokeToken(refreshToken);
    throw error;
  }

  const accountEmail = account?.user?.emailAddress || '';
  const previous = await getState();
  const accountChanged = Boolean(previous.accountEmail) && previous.accountEmail !== accountEmail;

  if (accountChanged && await countDriveFiles() > 0) {
    if (source === 'oauth') await revokeToken(refreshToken);
    throw httpError(
      `Files are stored in the Google Drive of ${previous.accountEmail}. Connect that account, or move the files before switching.`,
      409
    );
  }

  const next = {
    ...previous,
    encryptedRefreshToken,
    needsReconnect: false,
    accountEmail,
    accountName: account?.user?.displayName || '',
    connectedAt: new Date().toISOString(),
    connectedByUserId: userId
  };
  if (accountChanged) {
    delete next.backupFolderId;
    delete next.uploadsFolderId;
  }
  await saveState(next);
  clearClientCache();

  await ensureFolder('backup', { client });
  await ensureFolder('uploads', { client });
  return getState();
}

async function completeOAuth({ code, state, error }) {
  await refreshDriveSettings();
  const decoded = verifyConnectState(state);
  if (error) {
    throw httpError(error === 'access_denied' ? 'Google sign-in was cancelled.' : `Google sign-in failed: ${error}`, 400);
  }
  if (!code) throw httpError('Google did not return an authorization code.', 400);
  const config = assertConfigured();
  const tokens = await exchangeCode(config, code);
  if (!tokens.refresh_token) {
    throw httpError(
      'Google did not return a refresh token. Remove this app from your Google account permissions (myaccount.google.com/permissions) and connect again.',
      400
    );
  }
  return saveConnection(tokens.refresh_token, { userId: decoded.uid, source: 'oauth' });
}

// Applies GOOGLE_OAUTH_REFRESH_TOKEN once per token value, so a later disconnect is not undone on restart.
async function connectFromEnvToken() {
  await refreshDriveSettings();
  const config = getGoogleDriveConfig();
  if (!config.envRefreshToken || getGoogleDriveConfigProblems(config).length) return;
  const hash = sha256(config.envRefreshToken);
  const state = await getState();
  if (state.envTokenHash === hash) return;

  if (!envConnectPromise) {
    envConnectPromise = (async () => {
      try {
        await saveConnection(config.envRefreshToken, { source: 'env' });
      } catch (error) {
        console.error('Google Drive env refresh token could not be applied:', error.message);
      } finally {
        const latest = await getState();
        await saveState({ ...latest, envTokenHash: hash });
        envConnectPromise = null;
      }
    })();
  }
  await envConnectPromise;
}

async function getClient() {
  await connectFromEnvToken();
  const state = await getState();
  if (!state.encryptedRefreshToken) {
    throw httpError('Google Drive is not connected. Connect it in Settings → Storage & Backup.', 409);
  }
  if (state.needsReconnect) {
    throw httpError('Google Drive needs to be reconnected in Settings → Storage & Backup.', 409);
  }
  return clientFor(state);
}

async function isConnected() {
  await refreshDriveSettings();
  const state = await getState();
  return Boolean(state.encryptedRefreshToken) && !state.needsReconnect;
}

async function disconnect({ activeProvider }) {
  if (activeProvider === 'gdrive') {
    throw httpError('Google Drive is the active upload storage. Switch uploads to Local first.', 409);
  }
  if (await countDriveFiles() > 0) {
    throw httpError('Some uploaded files are stored in Google Drive and would stop opening. Drive cannot be disconnected.', 409);
  }

  const state = await getState();
  if (state.encryptedRefreshToken) {
    try {
      await revokeToken(decrypt(state.encryptedRefreshToken));
    } catch {
      // Undecryptable token is simply forgotten.
    }
  }
  clearClientCache();
  // envTokenHash is kept so a restart does not reconnect from the env token.
  await saveState({ envTokenHash: state.envTokenHash });
}

async function getStatus() {
  await connectFromEnvToken();
  const config = getGoogleDriveConfig();
  const state = await getState();
  return {
    configured: getGoogleDriveConfigProblems(config).length === 0,
    problems: getGoogleDriveConfigProblems(config),
    connected: Boolean(state.encryptedRefreshToken),
    needsReconnect: Boolean(state.needsReconnect),
    accountEmail: state.accountEmail || '',
    connectedAt: state.connectedAt || null,
    redirectUri: config.redirectUri,
    backupFolder: { name: state.backupFolderName || config.backupFolderName, link: folderLink(state.backupFolderId) },
    uploadsFolder: { name: state.uploadsFolderName || config.uploadsFolderName, link: folderLink(state.uploadsFolderId) }
  };
}

module.exports = {
  STATE_PURPOSE,
  completeOAuth,
  connectFromEnvToken,
  disconnect,
  ensureFolder,
  getAuthUrl,
  getClient,
  getState,
  getStatus,
  isConnected,
  markNeedsReconnect,
  saveConnection,
  setDriveFileCounterForTests,
  verifyConnectState,
  resetCache,
  _resetForTests: resetCache
};
