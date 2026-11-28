// Each user links their own Google Calendar from their profile ("Connect Google Calendar").
// The refresh token is kept encrypted in user_calendar_connections, like the Drive token.
// Sync mode, chosen by the user:
//   one_way  ERP → Google only (meetings, follow-ups, todos go into the calendar)
//   two_way  also Google → ERP (edits made in Google come back; their own Google events show in the ERP)
const jwt = require('jsonwebtoken');
const { query } = require('../../config/db');
const { getGoogleDriveConfig, refreshDriveSettings } = require('../../config/googleDrive');
const { decrypt, encrypt, hasEncryptionKey } = require('../../utils/encryption');
const { buildAuthUrl, exchangeCode, revokeToken } = require('../googleDrive/drive.client');
const { CalendarClient } = require('./calendar.client');

const STATE_PURPOSE = 'gcal-connect';
const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events';
const SYNC_MODES = ['one_way', 'two_way'];
const PROFILE_ROUTE = '/app/profile';

const clientCache = new Map(); // userId -> { key, client }

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

// Calendar has its own OAuth client (GOOGLE_CALENDAR_CLIENT_ID/SECRET); without one it shares the Drive client.
function oauthClient() {
  const ownId = String(process.env.GOOGLE_CALENDAR_CLIENT_ID || '').trim();
  const ownSecret = String(process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '').trim();
  if (ownId || ownSecret) return { clientId: ownId, clientSecret: ownSecret };
  const config = getGoogleDriveConfig();
  return { clientId: config.clientId, clientSecret: config.clientSecret };
}

function configProblems() {
  const config = oauthClient();
  const problems = [];
  if (!config.clientId) problems.push('GOOGLE_CALENDAR_CLIENT_ID (or GOOGLE_OAUTH_CLIENT_ID) is not set on the server');
  if (!config.clientSecret) problems.push('GOOGLE_CALENDAR_CLIENT_SECRET (or GOOGLE_OAUTH_CLIENT_SECRET) is not set on the server');
  if (!hasEncryptionKey()) problems.push('SETTINGS_ENCRYPTION_KEY is not set on the server');
  if (!process.env.JWT_SECRET) problems.push('JWT_SECRET is not set on the server');
  return problems;
}

function frontendUrl() {
  return getGoogleDriveConfig().frontendUrl || '';
}

function profileUrl(params = {}) {
  const query = new URLSearchParams(params).toString();
  const base = frontendUrl();
  return `${base}/#${PROFILE_ROUTE}${query ? `?${query}` : ''}`;
}

async function getRow(userId) {
  const result = await query('select * from user_calendar_connections where user_id = $1', [String(userId || '')]);
  return result.rows[0] || null;
}

async function listActiveConnections() {
  const result = await query(
    `select c.* from user_calendar_connections c join users u on u.id = c.user_id
     where c.encrypted_refresh_token is not null and c.needs_reconnect = false and u.is_active = true`
  );
  return result.rows;
}

function createState(userId, redirectUri) {
  return jwt.sign({ purpose: STATE_PURPOSE, uid: String(userId), ru: redirectUri }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '10m'
  });
}

function verifyState(state) {
  try {
    const decoded = jwt.verify(String(state || ''), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.purpose !== STATE_PURPOSE || !decoded.uid || !decoded.ru) throw new Error('wrong purpose');
    return decoded;
  } catch {
    throw httpError('The Google sign-in link expired or is invalid. Click Connect Google Calendar again.', 400);
  }
}

async function getAuthUrl({ userId, requestRedirectUri, loginHint = '' }) {
  await refreshDriveSettings();
  const problems = configProblems();
  if (problems.length) throw httpError(`Google Calendar is not set up on the server: ${problems.join('; ')}`, 400);
  const config = oauthClient();
  const redirectUri = String(process.env.GOOGLE_CALENDAR_REDIRECT_URI || '').trim() || requestRedirectUri;
  return buildAuthUrl({
    clientId: config.clientId,
    redirectUri,
    scope: SCOPES,
    state: createState(userId, redirectUri),
    loginHint
  });
}

// The id_token comes straight from Google's token endpoint over TLS, so its payload can be read as is.
function emailFromIdToken(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(String(idToken || '').split('.')[1] || '', 'base64url').toString('utf8'));
    return String(payload.email || '').toLowerCase();
  } catch {
    return '';
  }
}

async function completeOAuth({ code, state, error }) {
  await refreshDriveSettings();
  const decoded = verifyState(state);
  if (error) throw httpError(error === 'access_denied' ? 'Google sign-in was cancelled.' : `Google sign-in failed: ${error}`, 400);
  if (!code) throw httpError('Google did not return an authorization code.', 400);
  const config = oauthClient();
  const tokens = await exchangeCode({ clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: decoded.ru }, code);
  if (!tokens.refresh_token) {
    throw httpError('Google did not return a refresh token. Remove "Webitof" from myaccount.google.com/permissions and connect again.', 400);
  }
  const granted = String(tokens.scope || '');
  if (granted && !granted.includes('calendar')) {
    await revokeToken(tokens.refresh_token);
    throw httpError('Calendar access was not allowed on the Google screen. Connect again and tick the calendar permission.', 400);
  }
  const accountEmail = emailFromIdToken(tokens.id_token);
  const previous = await getRow(decoded.uid);
  // Another Google account means other event ids: links to the old calendar no longer apply.
  if (previous && previous.account_email && previous.account_email !== accountEmail) {
    await query('delete from calendar_event_links where user_id = $1', [decoded.uid]);
  }
  await query(
    `insert into user_calendar_connections (user_id, provider, account_email, encrypted_refresh_token, sync_mode, sync_token, needs_reconnect, needs_reconnect_since, last_error, connected_at, updated_at)
     values ($1, 'google', $2, $3::jsonb, $4, null, false, null, null, now(), now())
     on conflict (user_id) do update set account_email = excluded.account_email, encrypted_refresh_token = excluded.encrypted_refresh_token,
       sync_token = null, needs_reconnect = false, needs_reconnect_since = null, last_error = null, connected_at = now(), updated_at = now()`,
    [decoded.uid, accountEmail, JSON.stringify(encrypt(tokens.refresh_token)), previous?.sync_mode || 'one_way']
  );
  clientCache.delete(String(decoded.uid));
  // Put the user's upcoming meetings, follow-ups and todos into the calendar right away.
  setImmediate(() => {
    require('./calendarSync.service').syncUser(decoded.uid).catch((err) => console.error('[Calendar] First sync failed:', err.message));
  });
  return { userId: decoded.uid, accountEmail };
}

// Google refused the token: stop using it and tell the user once (in-app + email).
async function markNeedsReconnect(userId) {
  const row = await getRow(userId);
  clientCache.delete(String(userId));
  if (!row || row.needs_reconnect) return;
  await query(
    `update user_calendar_connections set needs_reconnect = true, needs_reconnect_since = now(), updated_at = now() where user_id = $1`,
    [String(userId)]
  );
  try {
    const { listUsers } = require('../auth.service');
    const user = (await listUsers()).find((item) => String(item.id) === String(userId));
    if (!user) return;
    const notifications = require('../notification.service');
    const title = 'Reconnect your Google Calendar';
    const message = `Google stopped accepting the calendar access of ${row.account_email || 'your account'}. Meetings, follow-ups and todos are not reaching your calendar. Open your profile and click Reconnect Google Calendar.`;
    await notifications.createInternalNotification({
      user, moduleName: 'calendar', eventKey: 'reconnect_needed', title, message, severity: 'warning', routePath: PROFILE_ROUTE
    });
  } catch (error) {
    console.error('[Calendar] Reconnect alert failed:', error.message);
  }
}

// { client, connection } for a user whose calendar is connected and working, else null.
async function clientForUser(userId) {
  const row = await getRow(userId);
  if (!row || !row.encrypted_refresh_token || row.needs_reconnect) return null;
  const key = row.encrypted_refresh_token?.ciphertext || '';
  const cached = clientCache.get(String(userId));
  if (cached && cached.key === key) return { client: cached.client, connection: row };
  let refreshToken;
  try {
    refreshToken = decrypt(row.encrypted_refresh_token);
  } catch {
    await markNeedsReconnect(userId);
    return null;
  }
  const config = oauthClient();
  const client = new CalendarClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken,
    onInvalidGrant: () => markNeedsReconnect(userId)
  });
  clientCache.set(String(userId), { key, client });
  return { client, connection: row };
}

async function setSyncMode(userId, mode) {
  if (!SYNC_MODES.includes(mode)) throw httpError('Choose one-way or two-way sync.', 400);
  const row = await getRow(userId);
  if (!row) throw httpError('Connect Google Calendar first.', 400);
  // Two-way starts with a fresh read of the calendar.
  await query(
    `update user_calendar_connections set sync_mode = $2, sync_token = case when $2 <> sync_mode then null else sync_token end, updated_at = now() where user_id = $1`,
    [String(userId), mode]
  );
  return getStatus(userId);
}

async function disconnect(userId) {
  const row = await getRow(userId);
  if (!row) return { disconnected: true };
  if (row.encrypted_refresh_token) {
    try {
      await revokeToken(decrypt(row.encrypted_refresh_token));
    } catch {
      // A token that cannot be decrypted is simply forgotten.
    }
  }
  clientCache.delete(String(userId));
  // Events already in the calendar stay there; the ERP just stops updating them.
  await query('delete from calendar_event_links where user_id = $1', [String(userId)]);
  // Events that came from Google into the ERP (two-way) are removed with the link.
  await query(
    `delete from lead_events where owner_user_id = $1 and scope_type = 'global' and payload->>'source' = 'google_calendar'`,
    [String(userId)]
  );
  await query('delete from user_calendar_connections where user_id = $1', [String(userId)]);
  return { disconnected: true };
}

async function getStatus(userId) {
  const problems = configProblems();
  const row = await getRow(userId);
  const counts = row
    ? (await query(
      `select count(*) filter (where origin <> 'google')::int as pushed, count(*) filter (where origin = 'google')::int as pulled
       from calendar_event_links where user_id = $1`,
      [String(userId)]
    )).rows[0]
    : { pushed: 0, pulled: 0 };
  return {
    configured: problems.length === 0,
    problems,
    connected: Boolean(row?.encrypted_refresh_token),
    needsReconnect: Boolean(row?.needs_reconnect),
    accountEmail: row?.account_email || '',
    syncMode: row?.sync_mode || 'one_way',
    connectedAt: row?.connected_at || null,
    lastPushAt: row?.last_push_at || null,
    lastPullAt: row?.last_pull_at || null,
    lastError: row?.last_error || '',
    eventsInCalendar: Number(counts?.pushed || 0),
    eventsFromCalendar: Number(counts?.pulled || 0)
  };
}

async function recordResult(userId, { push = false, pull = false, error = null } = {}) {
  await query(
    `update user_calendar_connections set
       last_push_at = case when $2 then now() else last_push_at end,
       last_pull_at = case when $3 then now() else last_pull_at end,
       last_error = $4, updated_at = now()
     where user_id = $1`,
    [String(userId), push, pull, error ? String(error).slice(0, 300) : null]
  );
}

module.exports = {
  SCOPES,
  SYNC_MODES,
  clientForUser,
  completeOAuth,
  configProblems,
  disconnect,
  getAuthUrl,
  getRow,
  getStatus,
  listActiveConnections,
  markNeedsReconnect,
  profileUrl,
  recordResult,
  setSyncMode,
  verifyState
};
