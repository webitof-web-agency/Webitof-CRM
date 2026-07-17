const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const CACHE_PREFIX = 'webitof-api-cache:v6';
const CACHE_TTL_MS = 15 * 60 * 1000;
const memoryCache = new Map();

function isBrowser() {
  return typeof window !== 'undefined';
}

function getCacheKey(method, path, token) {
  return JSON.stringify({ method, path, token: token || '' });
}

function readStoredCache(key) {
  if (!isBrowser()) return null;
  const memoryEntry = memoryCache.get(key);
  if (memoryEntry) {
    return memoryEntry;
  }

  try {
    const raw = window.sessionStorage.getItem(`${CACHE_PREFIX}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp || Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      window.sessionStorage.removeItem(`${CACHE_PREFIX}:${key}`);
      return null;
    }
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredCache(key, value) {
  if (!isBrowser()) return;
  const entry = { timestamp: Date.now(), value };
  memoryCache.set(key, entry);
  try {
    window.sessionStorage.setItem(`${CACHE_PREFIX}:${key}`, JSON.stringify(entry));
  } catch {
    // Ignore storage quota / privacy mode issues.
  }
}

function invalidateStoredCache(prefix = '') {
  if (!isBrowser()) return;
  const storageKeys = [];
  for (let i = 0; i < window.sessionStorage.length; i += 1) {
    const key = window.sessionStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      storageKeys.push(key);
    }
  }

  storageKeys.forEach((key) => {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const payload = JSON.parse(key.slice(`${CACHE_PREFIX}:`.length));
      const matchesPrefix = !prefix || String(payload.path || '').startsWith(prefix) || String(prefix).startsWith(String(payload.path || ''));
      if (matchesPrefix) {
        window.sessionStorage.removeItem(key);
        memoryCache.delete(key.slice(`${CACHE_PREFIX}:`.length));
      }
    } catch {
      window.sessionStorage.removeItem(key);
    }
  });
}

async function parseResponse(response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { success: false, message: text };
    }
  }

  if (!response.ok || data.success === false) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

export async function request(path, { method = 'GET', body, token, headers = {}, formData = null } = {}) {
  const cacheKey = getCacheKey(method, path, token);
  if (method === 'GET') {
    const cached = readStoredCache(cacheKey);
    if (cached) return cached.value;
  }

  const init = {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    }
  };

  if (formData) {
    init.body = formData;
  } else if (body != null) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const data = await parseResponse(response);

  if (method === 'GET') {
    writeStoredCache(cacheKey, data);
  } else {
    invalidateStoredCache(path.split('?')[0]);
  }

  return data;
}

export const api = {
  auth: {
    login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
    me: (token) => request('/auth/me', { token }),
    forgotPassword: (payload) => request('/auth/forgot-password', { method: 'POST', body: payload }),
    resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: payload }),
    updateProfile: (token, payload) => request('/auth/profile', { method: 'PATCH', token, body: payload }),
    deleteAvatar: (token) => request('/auth/avatar', { method: 'DELETE', token })
  },
  reports: {
    dashboard: (token) => request('/reports/dashboard', { token }),
    profitLoss: (token) => request('/reports/profit-loss', { token }),
    gst: (token) => request('/reports/gst', { token }),
    pendingPayables: (token) => request('/reports/pending-payables', { token }),
    caAudit: (token) => request('/reports/ca-audit', { token }),
    payroll: (token) => request('/reports/payroll', { token }),
    renewalDashboard: (token) => request('/reports/renewals', { token })
  },
  finance: {
    summary: (token) => request('/finance/summary', { token }),
    ledger: (token, query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value == null || value === '') return;
        params.set(key, value);
      });
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return request(`/finance/ledger${suffix}`, { token });
    },
    reconciliation: (token, query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value == null || value === '') return;
        params.set(key, value);
      });
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return request(`/finance/reconciliation${suffix}`, { token });
    }
  },
  settings: {
    get: (token) => request('/settings', { token }),
    save: (token, payload) => request('/settings', { method: 'PUT', token, body: payload })
  },
  files: {
    list: (token, search = '', moduleName = '', entityId = '', folderKey = '') =>
      request(`/files?search=${search}&moduleName=${moduleName}&entityId=${entityId}&folderKey=${folderKey}`, { token }),
    driveBrowse: (token, folderId = '') =>
      request(`/files/drive/browse?folderId=${folderId}`, { token }),
    get: (token, id) => request(`/files/${id}`, { token }),
    upload: (token, formData) => request('/files/upload', { method: 'POST', token, formData }),
    archive: (token, id) => request(`/files/${id}/archive`, { method: 'PATCH', token }),
    createFolder: (token, payload) => request('/files/drive/folder', { method: 'POST', token, body: payload }),
    renameDriveFile: (token, driveFileId, name) => request(`/files/drive/${driveFileId}/rename`, { method: 'PUT', token, body: { name } }),
    deleteDriveFile: (token, driveFileId) => request(`/files/drive/${driveFileId}`, { method: 'DELETE', token }),
    getUsage: (token) => request('/files/drive/usage', { token })
  },
  resources: {
    list: (path, token, search = '', query = {}) => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value == null || value === '') return;
        params.set(key, value);
      });
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return request(`${path}${suffix}`, { token });
    },
    get: (path, id, token) => request(`${path}/${id}`, { token }),
    create: (path, payload, token) => request(path, { method: 'POST', body: payload, token }),
    update: (path, id, payload, token) => request(`${path}/${id}`, { method: 'PUT', body: payload, token }),
    remove: (path, id, token) => request(`${path}/${id}`, { method: 'DELETE', token })
  },
  cache: {
    invalidate: (prefix = '') => invalidateStoredCache(prefix),
    clear: () => invalidateStoredCache('')
  }
};

export { API_BASE_URL };
