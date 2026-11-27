// Minimal Google OAuth + Drive v3 client over fetch (no googleapis SDK).
// Error messages are built from Google's reason only, never from tokens or request bodies.
const fs = require('fs');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const DRIVE_URL = 'https://www.googleapis.com/drive/v3';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

const CONNECT_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET'
]);
const CONNECT_RETRY_DELAYS_MS = [400, 1200];

// Files sent from disk (database backups) go up in chunks over the resumable session, so a dump is
// never held in memory whole. Google requires chunks in multiples of 256 KB (except the last).
const CHUNK_UNIT = 256 * 1024;
const DEFAULT_CHUNK_SIZE = 32 * CHUNK_UNIT; // 8 MB
// A chunk refused with 5xx / 429 or lost on the network is sent again after these pauses.
const CHUNK_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

let fetchImpl = (...args) => fetch(...args);
let chunkSize = DEFAULT_CHUNK_SIZE;
let sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setFetchForTests(fn) {
  fetchImpl = fn || ((...args) => fetch(...args));
}

function setUploadChunkSizeForTests(size) {
  if (size && size % CHUNK_UNIT !== 0) throw new Error('Chunk size must be a multiple of 256 KB');
  chunkSize = size || DEFAULT_CHUNK_SIZE;
}

function setSleepForTests(fn) {
  sleepImpl = fn || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
}

class DriveError extends Error {
  constructor(message, { statusCode = 502, reason = '' } = {}) {
    super(message);
    this.name = 'DriveError';
    this.statusCode = statusCode;
    this.reason = reason;
    this.expose = true;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isConnectError(error) {
  const code = error?.cause?.code || error?.code || '';
  return CONNECT_ERROR_CODES.has(code);
}

// Retries only failures where the request never reached Google.
async function fetchWithRetry(url, init) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchImpl(url, init);
    } catch (error) {
      if (!isConnectError(error) || attempt >= CONNECT_RETRY_DELAYS_MS.length) {
        if (isConnectError(error)) {
          throw new DriveError('Google could not be reached. Try again in a minute.', { statusCode: 503, reason: 'network' });
        }
        throw new DriveError('Google could not be reached.', { statusCode: 503, reason: 'network' });
      }
      await sleep(CONNECT_RETRY_DELAYS_MS[attempt]);
    }
  }
}

async function readGoogleError(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const error = body?.error;
  if (typeof error === 'string') {
    return { reason: error, message: body.error_description || error };
  }
  const reason = error?.errors?.[0]?.reason || error?.status || '';
  return { reason, message: error?.message || response.statusText || 'Request failed' };
}

async function postToken(params) {
  const response = await fetchWithRetry(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  });
  if (!response.ok) {
    const { reason, message } = await readGoogleError(response);
    throw new DriveError(`Google rejected the credentials: ${message}`, { statusCode: 400, reason });
  }
  return response.json();
}

// Google sign-in page for "Connect Google Drive". prompt=consent makes Google return a refresh
// token every time; loginHint pre-selects the allowed account.
function buildAuthUrl({ clientId, redirectUri, scope, state, loginHint = '' }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state
  });
  if (loginHint) params.set('login_hint', loginHint);
  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCode({ clientId, clientSecret, redirectUri }, code) {
  return postToken({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });
}

async function revokeToken(token) {
  try {
    await fetchWithRetry(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  } catch {
    // Best effort.
  }
}

// "Range: bytes=0-524287" on a 308 = Google has the first 524288 bytes. No header = none yet.
function receivedUpTo(response) {
  const match = /bytes=0-(\d+)/.exec(response.headers.get('range') || '');
  return match ? Number(match[1]) + 1 : 0;
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

// Asks the session how much Google already has: { done: file } or { offset }.
async function uploadStatus(location, total) {
  const response = await fetchImpl(location, {
    method: 'PUT',
    headers: { 'Content-Length': '0', 'Content-Range': `bytes */${total}` }
  });
  if (response.status === 200 || response.status === 201) return { done: await response.json() };
  if (response.status === 308) return { offset: receivedUpTo(response) };
  if (isRetryableStatus(response.status)) return { retry: true };
  const { reason, message } = await readGoogleError(response);
  throw new DriveError(`Google Drive upload failed: ${message}`, { statusCode: response.status, reason });
}

// Sends the file in chunks. After a 5xx / 429 / network failure it waits, asks the session where it
// stopped and carries on from there; a chunk is retried up to CHUNK_RETRY_DELAYS_MS.length times.
async function uploadChunks(location, filePath, total) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    let offset = 0;
    let failures = 0;
    for (;;) {
      const length = Math.min(chunkSize, total - offset);
      const chunk = Buffer.alloc(length);
      await handle.read(chunk, 0, length, offset);
      let response = null;
      try {
        response = await fetchImpl(location, {
          method: 'PUT',
          headers: {
            'Content-Length': String(length),
            'Content-Range': `bytes ${offset}-${offset + length - 1}/${total}`
          },
          body: chunk
        });
      } catch (error) {
        if (!isConnectError(error) && error?.name !== 'TypeError') throw error;
      }

      if (response && (response.status === 200 || response.status === 201)) return response.json();
      if (response && response.status === 308) {
        offset = receivedUpTo(response);
        failures = 0;
        continue;
      }
      if (response && !isRetryableStatus(response.status)) {
        const { reason, message } = await readGoogleError(response);
        throw new DriveError(`Google Drive upload failed: ${message}`, { statusCode: response.status, reason });
      }

      failures += 1;
      if (failures > CHUNK_RETRY_DELAYS_MS.length) {
        throw new DriveError('Google Drive upload failed: the upload kept failing after several retries.', { statusCode: 503, reason: 'upload_retries' });
      }
      await sleepImpl(CHUNK_RETRY_DELAYS_MS[failures - 1]);
      const status = await uploadStatus(location, total).catch((error) => {
        if (error instanceof DriveError) throw error;
        return { retry: true };
      });
      if (status.done) return status.done;
      if (!status.retry) offset = status.offset;
    }
  } finally {
    await handle.close();
  }
}

function escapeQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

class DriveClient {
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
    if (!force && this.accessToken && Date.now() < this.expiresAt - 60_000) {
      return this.accessToken;
    }
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
            throw new DriveError('Google Drive access was revoked or expired. Click Reconnect Google Drive in Settings → Storage & Backup.', {
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

  async request(url, { method = 'GET', headers = {}, body, expectJson = true, raw = false } = {}) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await this.getAccessToken(attempt > 0);
      const response = await fetchWithRetry(url, {
        method,
        headers: { ...headers, Authorization: `Bearer ${token}` },
        body
      });
      if (response.status === 401 && attempt === 0) {
        continue;
      }
      if (raw) return response;
      if (!response.ok) {
        const { reason, message } = await readGoogleError(response);
        throw new DriveError(`Google Drive: ${message}`, { statusCode: response.status, reason });
      }
      if (!expectJson || response.status === 204) return null;
      return response.json();
    }
    throw new DriveError('Google Drive rejected the credentials.', { statusCode: 401, reason: 'unauthorized' });
  }

  async about() {
    return this.request(`${DRIVE_URL}/about?fields=${encodeURIComponent('user(emailAddress,displayName)')}`);
  }

  async getFile(fileId, fields = 'id,name,mimeType,size,parents,trashed,createdTime,modifiedTime,webViewLink') {
    return this.request(`${DRIVE_URL}/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`);
  }

  async listFiles({ q, fields = 'id,name,mimeType,size,createdTime,parents', orderBy = '' }) {
    const files = [];
    let pageToken = '';
    do {
      const params = new URLSearchParams({
        q,
        fields: `nextPageToken,files(${fields})`,
        pageSize: '1000',
        spaces: 'drive',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true'
      });
      if (orderBy) params.set('orderBy', orderBy);
      if (pageToken) params.set('pageToken', pageToken);
      const data = await this.request(`${DRIVE_URL}/files?${params.toString()}`);
      files.push(...(data.files || []));
      pageToken = data.nextPageToken || '';
    } while (pageToken);
    return files;
  }

  async findFolder(name, parentId) {
    const clauses = [
      `name = '${escapeQueryValue(name)}'`,
      `mimeType = '${FOLDER_MIME}'`,
      'trashed = false'
    ];
    if (parentId) clauses.push(`'${escapeQueryValue(parentId)}' in parents`);
    const files = await this.listFiles({ q: clauses.join(' and '), fields: 'id,name,parents' });
    return files[0] || null;
  }

  async createFolder(name, parentId) {
    return this.request(`${DRIVE_URL}/files?fields=id,name,parents&supportsAllDrives=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME,
        ...(parentId ? { parents: [parentId] } : {})
      })
    });
  }

  // Resumable upload works for any size: one POST for the session, then the bytes. A buffer goes in
  // one PUT; a file on disk (filePath) goes in chunks that are retried on their own.
  // appProperties are private key/value strings stored with the file (backups keep their sha256 there).
  async uploadFile({
    name,
    parentId,
    mimeType = 'application/octet-stream',
    buffer,
    filePath = '',
    description = '',
    appProperties = null,
    fields = 'id,name,size,mimeType'
  }) {
    const total = filePath ? (await fs.promises.stat(filePath)).size : buffer.length;
    const session = await this.request(`${UPLOAD_URL}?uploadType=resumable&supportsAllDrives=true&fields=${encodeURIComponent(fields)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(total)
      },
      body: JSON.stringify({
        name,
        ...(parentId ? { parents: [parentId] } : {}),
        ...(description ? { description } : {}),
        ...(appProperties ? { appProperties } : {})
      }),
      raw: true
    });
    if (!session.ok) {
      const { reason, message } = await readGoogleError(session);
      throw new DriveError(`Google Drive: ${message}`, { statusCode: session.status, reason });
    }
    const location = session.headers.get('location');
    if (!location) {
      throw new DriveError('Google Drive did not start the upload.', { statusCode: 502 });
    }
    if (filePath && total > 0) return uploadChunks(location, filePath, total);
    const response = await fetchWithRetry(location, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType, 'Content-Length': String(buffer.length) },
      body: buffer
    });
    if (!response.ok) {
      const { reason, message } = await readGoogleError(response);
      throw new DriveError(`Google Drive upload failed: ${message}`, { statusCode: response.status, reason });
    }
    return response.json();
  }

  async updateFile(fileId, metadata) {
    return this.request(`${DRIVE_URL}/files/${encodeURIComponent(fileId)}?fields=id,name&supportsAllDrives=true`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    });
  }

  async deleteFile(fileId) {
    return this.request(`${DRIVE_URL}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
      method: 'DELETE',
      expectJson: false
    });
  }

  // Returns the raw fetch Response so callers can stream it and forward Range results.
  async download(fileId, { range = '' } = {}) {
    const response = await this.request(`${DRIVE_URL}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
      headers: range ? { Range: range } : {},
      raw: true
    });
    if (!response.ok && response.status !== 206) {
      const { reason, message } = await readGoogleError(response);
      throw new DriveError(`Google Drive: ${message}`, { statusCode: response.status, reason });
    }
    return response;
  }
}

module.exports = {
  DriveClient,
  DriveError,
  FOLDER_MIME,
  buildAuthUrl,
  escapeQueryValue,
  exchangeCode,
  revokeToken,
  setFetchForTests,
  setSleepForTests,
  setUploadChunkSizeForTests
};
