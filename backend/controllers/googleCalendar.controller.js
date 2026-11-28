const asyncHandler = require('../middlewares/asyncHandler');
const connection = require('../services/googleCalendar/calendarConnection.service');
const calendarSync = require('../services/googleCalendar/calendarSync.service');

// The callback URL on the host this request came in on (TRUST_PROXY behind Nginx for https).
function requestRedirectUri(req) {
  const prefix = String(process.env.API_PREFIX || '/api').replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}${prefix}/google-calendar/oauth/callback`;
}

const status = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await connection.getStatus(req.user.id) });
});

// "Connect Google Calendar": the Google sign-in URL the browser goes to.
const connect = asyncHandler(async (req, res) => {
  const url = await connection.getAuthUrl({
    userId: req.user.id,
    requestRedirectUri: requestRedirectUri(req),
    loginHint: req.user.email || ''
  });
  res.json({ success: true, data: { url } });
});

// Public: Google sends the browser here; the signed state says which user started it.
async function oauthCallback(req, res) {
  let params;
  try {
    const result = await connection.completeOAuth({ code: req.query.code, state: req.query.state, error: req.query.error });
    params = { gcal: 'connected', account: result.accountEmail || '' };
  } catch (error) {
    const message = error.expose ? error.message : 'Google Calendar could not be connected.';
    if (!error.expose) console.error('Google Calendar connect failed:', error);
    params = { gcal: 'error', message: String(message).slice(0, 300) };
  }
  const target = connection.profileUrl(params);
  if (/^https?:\/\//.test(target)) return res.redirect(target);
  res.type('text').send(params.gcal === 'connected' ? `Google Calendar connected (${params.account}). You can close this tab.` : params.message);
}

const setMode = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await connection.setSyncMode(req.user.id, String(req.body?.syncMode || '')) });
});

const syncNow = asyncHandler(async (req, res) => {
  const result = await calendarSync.syncUser(req.user.id);
  res.json({ success: true, data: result.status || (await connection.getStatus(req.user.id)), result });
});

const disconnect = asyncHandler(async (req, res) => {
  await connection.disconnect(req.user.id);
  res.json({ success: true, data: await connection.getStatus(req.user.id) });
});

module.exports = { connect, disconnect, oauthCallback, setMode, status, syncNow };
