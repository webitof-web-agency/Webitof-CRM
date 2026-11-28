// Firebase Cloud Messaging (HTTP v1) for both phone apps.
//   HRM app (com.webitof.employee)  devices with app = 'hrm', Android channel hrm_alerts
//   CRM app                          devices with app = 'crm', Android channel crm_alerts
// Credentials: FIREBASE_SERVICE_ACCOUNT_PATH (path to the service-account JSON) or
// FIREBASE_SERVICE_ACCOUNT_JSON (the JSON itself). Without them pushes are skipped and the in-app
// notification stays the record. The OAuth token is signed here, so no googleapis package is needed.
const fs = require('node:fs');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/db');

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const CHANNEL_BY_APP = { hrm: 'hrm_alerts', crm: 'crm_alerts' };

let account = null;
let loadError = '';
let accessToken = '';
let accessTokenExpiresAt = 0;

function loadAccount() {
  if (account || loadError) return account;
  try {
    const inline = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    const file = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();
    let raw = '';
    if (inline) raw = inline;
    else if (file && fs.existsSync(file)) raw = fs.readFileSync(file, 'utf8');
    if (!raw) {
      loadError = 'FIREBASE_SERVICE_ACCOUNT_PATH / FIREBASE_SERVICE_ACCOUNT_JSON is not set';
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) throw new Error('service account JSON is incomplete');
    account = parsed;
  } catch (error) {
    loadError = `Firebase service account could not be read: ${error.message}`;
  }
  return account;
}

function isConfigured() {
  return Boolean(loadAccount());
}

function status() {
  loadAccount();
  return { configured: Boolean(account), problem: account ? '' : loadError };
}

async function getAccessToken() {
  if (accessToken && Date.now() < accessTokenExpiresAt - 60_000) return accessToken;
  const key = loadAccount();
  if (!key) throw new Error(loadError);
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: key.client_email, scope: SCOPE, aud: key.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
    key.private_key,
    { algorithm: 'RS256' }
  );
  const response = await fetch(key.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString()
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(`Firebase token refused: ${data.error_description || data.error || response.status}`);
  accessToken = data.access_token;
  accessTokenExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return accessToken;
}

async function sendToToken(token, { title, body, data = {}, tag, app = 'hrm' }) {
  const key = loadAccount();
  if (!key) return { sent: false, reason: loadError };
  const bearer = await getAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${key.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: String(title || 'Webitof').slice(0, 200), body: String(body || '').slice(0, 900) },
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')])),
        android: {
          priority: 'high',
          notification: { channel_id: CHANNEL_BY_APP[app] || CHANNEL_BY_APP.hrm, ...(tag ? { tag } : {}) }
        },
        apns: { payload: { aps: { sound: 'default' } } }
      }
    })
  });
  if (response.ok) return { sent: true };
  const error = await response.json().catch(() => ({}));
  const reason = error?.error?.details?.[0]?.errorCode || error?.error?.status || response.statusText;
  // Uninstalled app / rotated token: forget the device.
  if (['UNREGISTERED', 'INVALID_ARGUMENT', 'NOT_FOUND'].includes(reason)) {
    await query('DELETE FROM hrm_devices WHERE token = $1', [token]).catch(() => {});
  }
  return { sent: false, reason };
}

// Sends to every registered phone of the user (both apps unless `apps` narrows it).
async function pushToUser(userId, message, { apps = null } = {}) {
  if (!userId || !isConfigured()) return [];
  const values = [String(userId)];
  let filter = '';
  if (Array.isArray(apps) && apps.length) {
    values.push(apps);
    filter = ` AND coalesce(app, 'hrm') = ANY($2::text[])`;
  }
  const devices = (await query(`SELECT token, coalesce(app, 'hrm') AS app FROM hrm_devices WHERE user_id = $1${filter}`, values)).rows;
  return Promise.all(devices.map((device) => sendToToken(device.token, { ...message, app: device.app })
    .catch((error) => ({ sent: false, reason: error.message }))));
}

async function registerDevice(userId, { token, platform = 'android', appVersion = '', app = 'crm' } = {}) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken || cleanToken.length > 4096) {
    const error = new Error('Device token is required');
    error.statusCode = 400;
    throw error;
  }
  const cleanPlatform = ['android', 'ios', 'web'].includes(platform) ? platform : 'android';
  const cleanApp = ['crm', 'hrm'].includes(app) ? app : 'crm';
  await query(
    `INSERT INTO hrm_devices (id, user_id, token, platform, app_version, app)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform,
       app_version = excluded.app_version, app = excluded.app, last_seen_at = now()`,
    [require('../../utils/format').createId('dev'), String(userId), cleanToken, cleanPlatform, String(appVersion || '').slice(0, 40), cleanApp]
  );
  return { registered: true };
}

async function removeDevice(userId, token) {
  await query('DELETE FROM hrm_devices WHERE user_id = $1 AND token = $2', [String(userId), String(token || '')]);
  return { removed: true };
}

module.exports = { isConfigured, pushToUser, registerDevice, removeDevice, sendToToken, status };
