// In-memory stand-in for Google's OAuth and Drive v3 endpoints, used through setFetchForTests.
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
    returnRefreshToken: true
  };

  function addFile({ name, parents = [], mimeType = 'application/octet-stream', content = Buffer.alloc(0), trashed = false }) {
    const id = `f${nextId++}`;
    clock += 1000;
    files.set(id, { id, name, parents, mimeType, content, trashed, createdTime: new Date(clock).toISOString() });
    return files.get(id);
  }

  function view(file) {
    return {
      id: file.id,
      name: file.name,
      parents: file.parents,
      mimeType: file.mimeType,
      size: String(file.content.length),
      trashed: file.trashed,
      createdTime: file.createdTime
    };
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
      uploadSessions.set(sessionId, { meta, mimeType: init.headers['X-Upload-Content-Type'] });
      return new Response(null, { status: 200, headers: { Location: `https://www.googleapis.com/upload-session/${sessionId}` } });
    }
    if (url.pathname.startsWith('/upload-session/') && method === 'PUT') {
      const session = uploadSessions.get(url.pathname.split('/').pop());
      for (const parent of session.meta.parents || []) {
        const folder = files.get(parent);
        if (!folder || folder.trashed) return jsonResponse(404, { error: { message: 'File not found', errors: [{ reason: 'notFound' }] } });
      }
      const file = addFile({
        name: session.meta.name,
        parents: session.meta.parents || [],
        mimeType: session.mimeType,
        content: Buffer.from(init.body)
      });
      return jsonResponse(200, view(file));
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
    if (match) {
      const file = files.get(decodeURIComponent(match[1]));
      if (!file) return jsonResponse(404, { error: { message: 'File not found', errors: [{ reason: 'notFound' }] } });
      if (method === 'DELETE') {
        files.delete(file.id);
        return new Response(null, { status: 204 });
      }
      if (method === 'PATCH') {
        Object.assign(file, JSON.parse(String(init.body)));
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
