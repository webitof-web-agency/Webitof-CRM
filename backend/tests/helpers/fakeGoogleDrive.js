// In-memory stand-in for Google's OAuth and Drive v3 endpoints, used through setFetchForTests.
// Uploads: one PUT with the whole body, or chunks with Content-Range (308 + Range until complete,
// "bytes */total" asks for the status). Files report md5Checksum and keep appProperties.
const crypto = require('crypto');

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function jsonResponse(status, body, headers = {}) {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

function parseQuery(q) {
  const clauses = {};
  const parent = /'([^']+)' in parents/.exec(q);
  if (parent) clauses.parent = parent[1];
  const name = /name = '((?:\\.|[^'])*)'/.exec(q);
  if (name) clauses.name = name[1].replace(/\\(.)/g, '$1');
  if (q.includes(`mimeType = '${FOLDER_MIME}'`)) clauses.folderOnly = true;
  if (q.includes('trashed = false')) clauses.notTrashed = true;
  return clauses;
}

function createFakeGoogleDrive({ email = 'owner@example.com', refreshToken = 'refresh-1', code = 'good-code' } = {}) {
  const files = new Map();
  const uploadSessions = new Map();
  const calls = [];
  let nextId = 1;
  let clock = Date.parse('2026-10-01T00:00:00Z');
  const state = {
    email,
    validRefreshTokens: new Set([refreshToken]),
    revoked: [],
    failNextTokenWith: '',
    returnRefreshToken: true,
    // Upload faults: the next N chunk PUTs answer this status; the next stored upload gets a byte flipped.
    failChunks: { count: 0, status: 503 },
    corruptNextUpload: false,
    chunkPuts: 0,
    myDriveRootId: 'my-drive-root'
  };

  function addFile({ name, parents = [], mimeType = 'application/octet-stream', content = Buffer.alloc(0), trashed = false, appProperties = null }) {
    const id = `f${nextId++}`;
    clock += 1000;
    files.set(id, { id, name, parents, mimeType, content, trashed, appProperties, createdTime: new Date(clock).toISOString() });
    return files.get(id);
  }

  function view(file) {
    const isFolder = file.mimeType === FOLDER_MIME;
    return {
      id: file.id,
      name: file.name,
      parents: file.parents,
      mimeType: file.mimeType,
      ...(isFolder ? {} : {
        size: String(file.content.length),
        md5Checksum: crypto.createHash('md5').update(file.content).digest('hex')
      }),
      ...(file.appProperties ? { appProperties: file.appProperties } : {}),
      trashed: file.trashed,
      createdTime: file.createdTime
    };
  }

  function storeUpload(session, content) {
    let stored = content;
    if (state.corruptNextUpload) {
      state.corruptNextUpload = false;
      stored = Buffer.from(content);
      stored[0] ^= 0xff;
    }
    return addFile({
      name: session.meta.name,
      parents: session.meta.parents || [],
      mimeType: session.mimeType,
      content: stored,
      appProperties: session.meta.appProperties || null
    });
  }

  async function fetchImpl(input, init = {}) {
    const url = new URL(String(input));
    const method = (init.method || 'GET').toUpperCase();
    calls.push({ method, url: url.toString(), headers: init.headers || {} });

    if (url.host === 'oauth2.googleapis.com' && url.pathname === '/token') {
      const params = new URLSearchParams(String(init.body));
      if (state.failNextTokenWith) {
        const error = state.failNextTokenWith;
        state.failNextTokenWith = '';
        return jsonResponse(400, { error, error_description: 'Token has been expired or revoked.' });
      }
      if (params.get('grant_type') === 'authorization_code') {
        if (params.get('code') !== code) return jsonResponse(400, { error: 'invalid_grant', error_description: 'Bad code' });
        return jsonResponse(200, {
          access_token: 'access-from-code',
          expires_in: 3600,
          ...(state.returnRefreshToken ? { refresh_token: refreshToken } : {})
        });
      }
      if (!state.validRefreshTokens.has(params.get('refresh_token'))) {
        return jsonResponse(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
      }
      return jsonResponse(200, { access_token: `access-${params.get('refresh_token')}`, expires_in: 3600 });
    }
    if (url.host === 'oauth2.googleapis.com' && url.pathname === '/revoke') {
      state.revoked.push(url.searchParams.get('token'));
      return jsonResponse(200, {});
    }

    const auth = (init.headers || {}).Authorization || (init.headers || {}).authorization || '';
    if (!auth.startsWith('Bearer access-') && !url.pathname.startsWith('/upload-session/')) {
      return jsonResponse(401, { error: { message: 'Invalid Credentials', errors: [{ reason: 'authError' }] } });
    }

    if (url.pathname === '/drive/v3/about') {
      return jsonResponse(200, { user: { emailAddress: state.email, displayName: 'Owner' } });
    }

    if (url.pathname === '/upload/drive/v3/files' && method === 'POST') {
      const meta = JSON.parse(String(init.body));
      const sessionId = `s${nextId++}`;
      uploadSessions.set(sessionId, {
        meta,
        mimeType: init.headers['X-Upload-Content-Type'],
        total: Number(init.headers['X-Upload-Content-Length'] || 0),
        received: Buffer.alloc(0),
        file: null
      });
      return new Response(null, { status: 200, headers: { Location: `https://www.googleapis.com/upload-session/${sessionId}` } });
    }
    if (url.pathname.startsWith('/upload-session/') && method === 'PUT') {
      const session = uploadSessions.get(url.pathname.split('/').pop());
      for (const parent of session.meta.parents || []) {
        const folder = files.get(parent);
        if (!folder || folder.trashed) return jsonResponse(404, { error: { message: 'File not found', errors: [{ reason: 'notFound' }] } });
      }
      const contentRange = (init.headers || {})['Content-Range'] || '';
      const progress = () => (session.received.length
        ? new Response(null, { status: 308, headers: { Range: `bytes=0-${session.received.length - 1}` } })
        : new Response(null, { status: 308 }));
      if (!contentRange) {
        // Single PUT with the whole body.
        return jsonResponse(200, view(storeUpload(session, Buffer.from(init.body))));
      }
      if (contentRange.startsWith('bytes */')) {
        if (session.file) return jsonResponse(200, view(session.file));
        return progress();
      }
      state.chunkPuts += 1;
      if (state.failChunks.count > 0) {
        state.failChunks.count -= 1;
        return jsonResponse(state.failChunks.status, { error: { message: 'Backend Error', errors: [{ reason: 'backendError' }] } });
      }
      const [, start, end, total] = /bytes (\d+)-(\d+)\/(\d+)/.exec(contentRange).map(Number);
      const body = Buffer.from(init.body);
      if (start !== session.received.length || body.length !== end - start + 1) {
        return jsonResponse(400, { error: { message: `Bad chunk ${contentRange}`, errors: [{ reason: 'badRequest' }] } });
      }
      // Google only accepts non-final chunks in multiples of 256 KB.
      if (end + 1 < total && body.length % (256 * 1024) !== 0) {
        return jsonResponse(400, { error: { message: 'Chunk is not a multiple of 256 KB', errors: [{ reason: 'badRequest' }] } });
      }
      session.received = Buffer.concat([session.received, body]);
      if (session.received.length < total) return progress();
      session.file = storeUpload(session, session.received);
      return jsonResponse(200, view(session.file));
    }

    if (url.pathname === '/drive/v3/files' && method === 'GET') {
      const clauses = parseQuery(url.searchParams.get('q') || '');
      let list = Array.from(files.values()).filter((file) => {
        if (clauses.parent && !file.parents.includes(clauses.parent)) return false;
        if (clauses.name !== undefined && file.name !== clauses.name) return false;
        if (clauses.folderOnly && file.mimeType !== FOLDER_MIME) return false;
        if (clauses.notTrashed && file.trashed) return false;
        return true;
      });
      if ((url.searchParams.get('orderBy') || '').startsWith('createdTime desc')) {
        list = list.sort((a, b) => b.createdTime.localeCompare(a.createdTime));
      }
      return jsonResponse(200, { files: list.map(view) });
    }
    if (url.pathname === '/drive/v3/files' && method === 'POST') {
      const meta = JSON.parse(String(init.body));
      return jsonResponse(200, view(addFile({ name: meta.name, parents: meta.parents || [], mimeType: meta.mimeType })));
    }

    const match = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname);
    // "root" is the alias of the account's My Drive; Google answers with its real id.
    if (match && match[1] === 'root' && method === 'GET') return jsonResponse(200, { id: state.myDriveRootId });
    if (match) {
      const file = files.get(decodeURIComponent(match[1]));
      if (!file) return jsonResponse(404, { error: { message: 'File not found', errors: [{ reason: 'notFound' }] } });
      if (method === 'DELETE') {
        files.delete(file.id);
        return new Response(null, { status: 204 });
      }
      if (method === 'PATCH') {
        Object.assign(file, JSON.parse(String(init.body)));
        const add = url.searchParams.get('addParents');
        const remove = (url.searchParams.get('removeParents') || '').split(',').filter(Boolean);
        if (add || remove.length) file.parents = [...file.parents.filter((id) => !remove.includes(id)), ...(add ? [add] : [])];
        return jsonResponse(200, view(file));
      }
      if (url.searchParams.get('alt') === 'media') {
        return new Response(file.content, { status: 200, headers: { 'Content-Length': String(file.content.length) } });
      }
      return jsonResponse(200, view(file));
    }

    return jsonResponse(404, { error: { message: `Unhandled ${method} ${url.pathname}` } });
  }

  function findByName(name) {
    return Array.from(files.values()).find((file) => file.name === name) || null;
  }

  function pathOf(file) {
    const parts = [];
    let current = file;
    while (current) {
      parts.unshift(current.name);
      current = current.parents[0] ? files.get(current.parents[0]) : null;
    }
    return parts.join('/');
  }

  return { addFile, calls, fetchImpl, files, findByName, pathOf, state };
}

module.exports = { createFakeGoogleDrive };
