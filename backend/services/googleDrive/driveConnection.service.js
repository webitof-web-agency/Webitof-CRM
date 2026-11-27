// The single connected Google account: encrypted refresh token, account and folders.
// An admin clicks "Connect Google Drive" (Settings → Storage & Backup), signs in to Google and the
// refresh token Google returns is kept encrypted in the database. Only GDRIVE_ALLOWED_EMAIL may be
// connected. When Google stops accepting the token, admins get a notification and an email and
// the same button reconnects. A token in GOOGLE_OAUTH_REFRESH_TOKEN still works as a fallback.
const jwt = require('jsonwebtoken');
const { query } = require('../../config/db');
const { getGoogleDriveConfig, getGoogleDriveConfigProblems, refreshDriveSettings } = require('../../config/googleDrive');
const { decrypt, encrypt, sha256 } = require('../../utils/encryption');
const { getSetting, setSetting } = require('../../models/systemSetting.model');
const { DriveClient, DriveError, buildAuthUrl, exchangeCode, revokeToken } = require('./drive.client');
const { CATEGORY_FOLDERS } = require('../../utils/uploadPath');

const SETTINGS_KEY = 'google_drive';
const STATE_PURPOSE = 'gdrive-connect';
const SETTINGS_ROUTE = '/app/settings/storage';
// While the connection stays broken, admins are reminded once a day.
const REMIND_MS = 24 * 60 * 60 * 1000;
// Folders the app owns, each with the folder it sits in:
//   <GDRIVE_PARENT_FOLDER_ID>/Webitof ERP Data          root: uploads go straight in (01 CRM ... 07 General)
//   Webitof ERP Data/99 Backups                         backupsRoot
//   Webitof ERP Data/99 Backups/Database                backup: year / month / day folders with the dumps
const FOLDER_KINDS = {
  root: { idKey: 'rootFolderId', nameKey: 'rootFolderName', configKey: 'rootFolderName', parent: null },
  backupsRoot: { idKey: 'backupsRootFolderId', nameKey: 'backupsRootFolderName', configKey: 'backupFolderName', parent: 'root' },
  backup: { idKey: 'backupDatabaseFolderId', nameKey: 'backupDatabaseFolderName', configKey: 'backupDatabaseFolderName', parent: 'backupsRoot' }
};
// Folder ids that belong to one Google account / parent folder; dropped when either changes.
const FOLDER_STATE_KEYS = [
  ...Object.values(FOLDER_KINDS).map((kind) => kind.idKey),
  'categoryFolderIds',
  // Layout before "Webitof ERP Data": separate uploads and backups folders.
  'uploadsFolderId',
  'backupFolderId'
];

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

function settingsUrl() {
  const base = getGoogleDriveConfig().frontendUrl;
  return base ? `${base}/#${SETTINGS_ROUTE}` : SETTINGS_ROUTE;
}

// In-app notification + email to everyone who can change settings (they are the ones who can reconnect).
async function notifyDriveAdmins({ eventKey, title, message }) {
  const { listUsers, getUserAccessProfile } = require('../auth.service');
  const { hasPermission } = require('../../middlewares/auth');
  const notifications = require('../notification.service');
  const users = await listUsers();
  for (const user of users) {
    if (!user?.isActive) continue;
    const profile = await getUserAccessProfile(user.id).catch(() => null);
    if (!hasPermission(profile, 'settings.write')) continue;
    try {
      await notifications.createInternalNotification({
        user, moduleName: 'settings', eventKey, title, message, severity: 'danger', routePath: SETTINGS_ROUTE, channels: ['inApp', 'email']
      });
      if (user.email) {
        await notifications.sendNotificationEmail({ to: user.email, subject: title, title, message, routePath: settingsUrl(), severity: 'danger' });
      }
    } catch (error) {
      console.error(`Google Drive alert to user ${user.id} failed:`, error.message);
    }
  }
}

async function alertNeedsReconnect() {
  const state = await getState();
  await saveState({ ...state, reconnectAlertedAt: new Date().toISOString() });
  const account = state.accountEmail || 'the Google account';
  await notifyDriveAdmins({
    eventKey: 'gdrive_reconnect_needed',
    title: 'Google Drive needs to be reconnected',
    message: `Google stopped accepting the Drive access of ${account}. Uploads to Drive and the daily database backup are paused. Open Settings → Storage & Backup and click Reconnect Google Drive.`
  });
}

// Google refused the token (revoked, expired, app back in testing): stop using it and tell the admins once.
async function markNeedsReconnect() {
  const state = await getState();
  if (!state.encryptedRefreshToken) return;
  clearClientCache();
  if (state.needsReconnect) return;
  await saveState({ ...state, needsReconnect: true, needsReconnectSince: new Date().toISOString() });
  alertNeedsReconnect().catch((error) => console.error('Google Drive reconnect alert failed:', error.message));
}

function assertConfigured() {
  const problems = getGoogleDriveConfigProblems();
  if (problems.length) {
    throw httpError(`Google Drive is not configured: ${problems.join('; ')}`, 400);
  }
  return getGoogleDriveConfig();
}

// The sign-in round trip carries a short-lived signed state: it proves an admin started it and
// fixes the redirect URI the code must be exchanged with.
function createConnectState(userId, redirectUri) {
  return jwt.sign({ purpose: STATE_PURPOSE, uid: userId, ru: redirectUri }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '10m'
  });
}

function verifyConnectState(state) {
  try {
    const decoded = jwt.verify(String(state || ''), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.purpose !== STATE_PURPOSE || !decoded.ru) throw new Error('wrong purpose');
    return decoded;
  } catch {
    throw httpError('The Google sign-in link expired or is invalid. Click Connect Google Drive again.', 400);
  }
}

// requestRedirectUri: the callback URL on the host the admin is using; GOOGLE_OAUTH_REDIRECT_URI wins.
async function getAuthUrl({ userId, requestRedirectUri }) {
  await refreshDriveSettings();
  const config = assertConfigured();
  if (!process.env.JWT_SECRET) throw httpError('JWT_SECRET is not set on the server.', 400);
  const redirectUri = config.redirectUri || requestRedirectUri;
  return buildAuthUrl({
    clientId: config.clientId,
    redirectUri,
    scope: config.scope,
    state: createConnectState(userId, redirectUri),
    loginHint: config.allowedEmail
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
    throw httpError('Stored Google Drive credentials could not be decrypted (SETTINGS_ENCRYPTION_KEY changed?). Click Check connection in Settings → Storage & Backup.', 409);
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
  // Uploads are filed straight inside the main folder.
  if (kind === 'uploads') return ensureFolder('root', { client });
  const definition = FOLDER_KINDS[kind];
  if (!definition) throw new Error(`Unknown folder kind: ${kind}`);
  const config = getGoogleDriveConfig();
  const driveClient = client || clientFor(await getState());
  const parentId = definition.parent
    ? await ensureFolder(definition.parent, { client: driveClient })
    : config.parentFolderId;
  const state = await getState();
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
      if (!definition.parent && error instanceof DriveError && (error.statusCode === 404 || error.statusCode === 403)) {
        throw httpError(
          'GDRIVE_PARENT_FOLDER_ID could not be opened. Check the id, and that the folder is in the Drive of the connected Google account.',
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

// The top folders of the upload tree (01 CRM ... 07 General), made as soon as Drive is connected
// so the structure is visible before the first upload. Their ids are kept for the Settings links.
async function ensureCategoryFolders({ client = null } = {}) {
  const driveClient = client || clientFor(await getState());
  const rootId = await ensureFolder('root', { client: driveClient });
  const ids = {};
  for (const name of CATEGORY_FOLDERS) {
    const found = await driveClient.findFolder(name, rootId);
    ids[name] = (found || await driveClient.createFolder(name, rootId)).id;
  }
  await saveState({ ...(await getState()), categoryFolderIds: ids });
  return ids;
}

function folderLinks(state, config) {
  return {
    rootFolder: { name: state.rootFolderName || config.rootFolderName, link: folderLink(state.rootFolderId) },
    backupFolder: {
      name: `${state.backupsRootFolderName || config.backupFolderName}/${config.backupDatabaseFolderName}`,
      link: folderLink(state.backupDatabaseFolderId || state.backupsRootFolderId)
    },
    categoryFolders: CATEGORY_FOLDERS.map((name) => ({ name, link: folderLink(state.categoryFolderIds?.[name]) }))
  };
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
  if (config.allowedEmail && accountEmail.toLowerCase() !== config.allowedEmail) {
    if (source === 'oauth') await revokeToken(refreshToken);
    throw httpError(
      `Only ${config.allowedEmail} can be connected; Google signed in ${accountEmail || 'another account'}. Click Connect again and choose ${config.allowedEmail}.`,
      403
    );
  }
  const previous = await getState();
  const accountChanged = Boolean(previous.accountEmail) && previous.accountEmail !== accountEmail;

  if (accountChanged && await countDriveFiles() > 0) {
    if (source === 'oauth') await revokeToken(refreshToken);
    throw httpError(
      `Files are stored in the Google Drive of ${previous.accountEmail}. Connect that account, or move the files before switching.`,
      409
    );
  }

  const { needsReconnectSince, reconnectAlertedAt, ...kept } = previous;
  const next = {
    ...kept,
    encryptedRefreshToken,
    needsReconnect: false,
    connectSource: source,
    accountEmail,
    accountName: account?.user?.displayName || '',
    connectedAt: new Date().toISOString(),
    connectedByUserId: userId
  };
  if (accountChanged) {
    for (const key of FOLDER_STATE_KEYS) delete next[key];
  }
  await saveState(next);
  clearClientCache();

  // Connecting builds the whole tree: Webitof ERP Data, its 01 CRM ... 07 General folders and
  // 99 Backups/Database.
  await ensureCategoryFolders({ client });
  await ensureFolder('backup', { client });
  return getState();
}

// Google sent the browser back from "Connect Google Drive" with a one-time code.
async function completeOAuth({ code, state, error }) {
  await refreshDriveSettings();
  const decoded = verifyConnectState(state);
  if (error) {
    throw httpError(error === 'access_denied' ? 'Google sign-in was cancelled.' : `Google sign-in failed: ${error}`, 400);
  }
  if (!code) throw httpError('Google did not return an authorization code.', 400);
  const config = assertConfigured();
  const tokens = await exchangeCode({ ...config, redirectUri: decoded.ru }, code);
  if (!tokens.refresh_token) {
    throw httpError(
      'Google did not return a refresh token. Remove the app from myaccount.google.com/permissions for this Google account and click Connect again.',
      400
    );
  }
  await saveConnection(tokens.refresh_token, { userId: decoded.uid || null, source: 'oauth' });
  // A token still sitting in the env must not replace the one just connected on the next request.
  const latest = await getState();
  const envHash = config.envRefreshToken ? sha256(config.envRefreshToken) : latest.envTokenHash;
  const { envTokenFailedHash, envTokenFailedAt, envTokenError, ...rest } = latest;
  await saveState({ ...rest, envTokenHash: envHash });
  return getState();
}

// Scheduled check (server.js): proves Google still accepts the refresh token, so a revoked token
// is noticed within hours instead of at the next backup. While it stays broken, admins are
// reminded once a day.
async function healthCheck() {
  await refreshDriveSettings();
  const state = await getState();
  if (!state.encryptedRefreshToken) return { checked: false, reason: 'not connected' };
  if (state.needsReconnect) {
    const lastAlert = Date.parse(state.reconnectAlertedAt || '');
    if (!(Date.now() - lastAlert < REMIND_MS)) await alertNeedsReconnect();
    return { checked: false, reason: 'needs reconnect' };
  }
  try {
    await clientFor(state).getAccessToken(true);
    return { checked: true, ok: true };
  } catch (error) {
    // invalid_grant has already marked the connection and alerted the admins.
    if (error.reason === 'invalid_grant' || error.statusCode === 409) return { checked: true, ok: false };
    throw error;
  }
}

// "Check connection": applies the refresh token from the server env right away (also one that
// failed before or was disconnected), then proves the account and both app folders work.
// Errors go back to the admin as they are.
async function checkConnection({ userId = null } = {}) {
  await refreshDriveSettings({ force: true });
  const config = assertConfigured();
  if (config.envRefreshToken) {
    const hash = sha256(config.envRefreshToken);
    const state = await getState();
    if (state.envTokenHash !== hash || !state.encryptedRefreshToken || state.needsReconnect) {
      try {
        await saveConnection(config.envRefreshToken, { userId, source: 'settings' });
      } catch (error) {
        const latest = await getState();
        await saveState({
          ...latest,
          envTokenFailedHash: hash,
          envTokenFailedAt: new Date().toISOString(),
          envTokenError: String(error.message || 'Unknown error').slice(0, 300)
        });
        throw httpError(`Google Drive did not accept these credentials: ${error.message}`, 400);
      }
      const { envTokenFailedHash, envTokenFailedAt, envTokenError, ...latest } = await getState();
      await saveState({ ...latest, envTokenHash: hash });
    }
  }
  const state = await getState();
  if (!state.encryptedRefreshToken) throw httpError('Google Drive is not connected yet. Click Connect Google Drive.', 400);
  if (state.needsReconnect) throw httpError('Google Drive access expired. Click Reconnect Google Drive.', 409);
  const client = clientFor(state);
  const account = await client.about();
  await ensureCategoryFolders({ client });
  await ensureFolder('backup', { client });
  const latest = await getState();
  return {
    accountEmail: account?.user?.emailAddress || latest.accountEmail || '',
    accountName: account?.user?.displayName || latest.accountName || '',
    ...folderLinks(latest, config)
  };
}

// Applies GOOGLE_OAUTH_REFRESH_TOKEN once per token value, so a later disconnect is not undone on restart.
// A token Google rejected (or a network error) is retried after a pause instead of being
// marked as applied, and the reason is shown in Settings → Storage & Backup.
const ENV_TOKEN_RETRY_MS = 15 * 60 * 1000;

async function connectFromEnvToken() {
  await refreshDriveSettings();
  const config = getGoogleDriveConfig();
  if (!config.envRefreshToken || getGoogleDriveConfigProblems(config).length) return;
  const hash = sha256(config.envRefreshToken);
  const state = await getState();
  if (state.envTokenHash === hash) return;
  const failedAt = state.envTokenFailedHash === hash ? Date.parse(state.envTokenFailedAt || '') : NaN;
  if (Date.now() - failedAt < ENV_TOKEN_RETRY_MS) return;

  if (!envConnectPromise) {
    envConnectPromise = (async () => {
      try {
        await saveConnection(config.envRefreshToken, { source: 'env' });
        const { envTokenFailedHash, envTokenFailedAt, envTokenError, ...latest } = await getState();
        await saveState({ ...latest, envTokenHash: hash });
      } catch (error) {
        console.error('Google Drive env refresh token could not be applied:', error.message);
        const latest = await getState();
        await saveState({
          ...latest,
          envTokenFailedHash: hash,
          envTokenFailedAt: new Date().toISOString(),
          envTokenError: String(error.message || 'Unknown error').slice(0, 300)
        });
      } finally {
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
    throw httpError('Google Drive is not connected. Click Connect Google Drive in Settings → Storage & Backup.', 409);
  }
  if (state.needsReconnect) {
    throw httpError('Google Drive access expired. Click Reconnect Google Drive in Settings → Storage & Backup.', 409);
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
  const problems = getGoogleDriveConfigProblems(config);
  return {
    // configured = the Connect button can be used (client id/secret and the encryption key are set).
    configured: problems.length === 0,
    problems,
    connected: Boolean(state.encryptedRefreshToken),
    needsReconnect: Boolean(state.needsReconnect),
    needsReconnectSince: state.needsReconnect ? state.needsReconnectSince || null : null,
    allowedEmail: config.allowedEmail || '',
    connectSource: state.connectSource || '',
    // Why the refresh token from the server env was not applied (empty once it works).
    envTokenError: !state.encryptedRefreshToken && config.envRefreshToken && state.envTokenFailedHash === sha256(config.envRefreshToken)
      ? state.envTokenError || ''
      : '',
    accountEmail: state.accountEmail || '',
    connectedAt: state.connectedAt || null,
    ...folderLinks(state, config)
  };
}

module.exports = {
  STATE_PURPOSE,
  checkConnection,
  completeOAuth,
  connectFromEnvToken,
  disconnect,
  ensureCategoryFolders,
  ensureFolder,
  getAuthUrl,
  getClient,
  getState,
  getStatus,
  healthCheck,
  isConnected,
  markNeedsReconnect,
  saveConnection,
  verifyConnectState,
  setDriveFileCounterForTests,
  resetCache,
  _resetForTests: resetCache
};
