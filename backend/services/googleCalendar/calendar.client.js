// Minimal Google Calendar v3 client over fetch, for one user's connected account.
// Token handling is the same as the Drive client (same OAuth client and token endpoint).
const { DriveError, fetchWithRetry, postToken, readGoogleError } = require('../googleDrive/drive.client');

const CALENDAR_URL = 'https://www.googleapis.com/calendar/v3';

class CalendarError extends DriveError {}

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

class CalendarClient {
  constructor({ clientId, clientSecret, refreshToken, onInvalidGrant = null }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.onInvalidGrant = onInvalidGrant;
    this.accessToken = '';
    this.expiresAt = 0;
    this.refreshing = null;
  }

  async getAccessToken(force = false) {
    if (!force && this.accessToken && Date.now() < this.expiresAt - 60_000) return this.accessToken;
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const data = await postToken({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            refresh_token: this.refreshToken,
            grant_type: 'refresh_token'
          });
          this.accessToken = data.access_token;
          this.expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
          return this.accessToken;
        } catch (error) {
          if (error.reason === 'invalid_grant') {
            if (this.onInvalidGrant) await this.onInvalidGrant();
            throw new CalendarError('Google Calendar access was revoked or expired. Reconnect it from your profile.', {
              statusCode: 409,
              reason: 'invalid_grant'
            });
          }
          throw error;
        } finally {
          this.refreshing = null;
        }
      })();
    }
    return this.refreshing;
  }

  async request(path, { method = 'GET', query = {}, body } = {}) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await this.getAccessToken(attempt > 0);
      const response = await fetchWithRetry(`${CALENDAR_URL}${path}${toQuery(query)}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
      if (response.status === 401 && attempt === 0) continue;
      if (!response.ok) {
        const { reason, message } = await readGoogleError(response);
        throw new CalendarError(`Google Calendar: ${message}`, { statusCode: response.status, reason });
      }
      if (response.status === 204) return null;
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }
    throw new CalendarError('Google Calendar rejected the credentials.', { statusCode: 401, reason: 'unauthorized' });
  }

  static eventPath(calendarId, eventId = '') {
    const base = `/calendars/${encodeURIComponent(calendarId || 'primary')}/events`;
    return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
  }

  insertEvent(calendarId, event, { sendUpdates = 'none', conferenceDataVersion = 0 } = {}) {
    return this.request(CalendarClient.eventPath(calendarId), {
      method: 'POST',
      query: { sendUpdates, conferenceDataVersion: conferenceDataVersion || undefined },
      body: event
    });
  }

  patchEvent(calendarId, eventId, event, { sendUpdates = 'none' } = {}) {
    return this.request(CalendarClient.eventPath(calendarId, eventId), {
      method: 'PATCH',
      query: { sendUpdates },
      body: event
    });
  }

  deleteEvent(calendarId, eventId, { sendUpdates = 'none' } = {}) {
    return this.request(CalendarClient.eventPath(calendarId, eventId), {
      method: 'DELETE',
      query: { sendUpdates }
    });
  }

  listEvents(calendarId, params = {}) {
    return this.request(CalendarClient.eventPath(calendarId), { query: params });
  }
}

module.exports = { CalendarClient, CalendarError };
