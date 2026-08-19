const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const CACHE_PREFIX = 'webitof-api-cache:v7';
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

export async function request(path, { method = 'GET', body, token, headers = {}, formData = null, skipCache = false } = {}) {
  const cacheKey = getCacheKey(method, path, token);
  if (method === 'GET' && !skipCache) {
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

  if (method === 'GET' && !skipCache) {
    writeStoredCache(cacheKey, data);
  } else {
    invalidateStoredCache(path.split('?')[0]);
  }

  return data;
}

export const api = {
  auth: {
    login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
    me: (token) => request('/auth/me', { token, skipCache: true }),
    forgotPassword: (payload) => request('/auth/forgot-password', { method: 'POST', body: payload }),
    resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: payload }),
    updateProfile: (token, payload) => request('/auth/profile', { method: 'PATCH', token, body: payload }),
    deleteAvatar: (token) => request('/auth/avatar', { method: 'DELETE', token })
  },
  reports: {
    dashboard: (token) => request('/reports/dashboard', { token, skipCache: true }),
    profitLoss: (token) => request('/reports/profit-loss', { token, skipCache: true }),
    gst: (token) => request('/reports/gst', { token, skipCache: true }),
    pendingPayables: (token) => request('/reports/pending-payables', { token, skipCache: true }),
    caAudit: (token) => request('/reports/ca-audit', { token, skipCache: true }),
    payroll: (token) => request('/reports/payroll', { token, skipCache: true }),
    renewalDashboard: (token) => request('/reports/renewals', { token, skipCache: true })
  },
  finance: {
    summary: (token, query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value == null || value === '') return;
        params.set(key, value);
      });
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return request(`/finance/summary${suffix}`, { token, skipCache: true });
    },
    ledger: (token, query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value == null || value === '') return;
        params.set(key, value);
      });
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return request(`/finance/ledger${suffix}`, { token, skipCache: true });
    },
    reconciliation: (token, query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value == null || value === '') return;
        params.set(key, value);
      });
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return request(`/finance/reconciliation${suffix}`, { token, skipCache: true });
    }
  },
  settings: {
    get: (token) => request('/settings', { token, skipCache: true }),
    save: (token, payload) => request('/settings', { method: 'PUT', token, body: payload })
  },
  notifications: {
    list: (token, query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value == null || value === '') return;
        params.set(key, value);
      });
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return request(`/notifications${suffix}`, { token, skipCache: true });
    },
    unreadCount: (token) => request('/notifications/unread-count', { token, skipCache: true }),
    markRead: (token, id) => request(`/notifications/${id}/read`, { method: 'PATCH', token, skipCache: true }),
    markAllRead: (token) => request('/notifications/read-all', { method: 'PATCH', token, skipCache: true })
  },
  followUps: {
    list: (token, query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value == null || value === '') return;
        params.set(key, value);
      });
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return request(`/follow-ups${suffix}`, { token, skipCache: true });
    },
    get: (token, id) => request(`/follow-ups/${id}`, { token, skipCache: true }),
    options: (token) => request('/follow-ups/options', { token }),
    today: (token, date = '') => request(`/follow-ups/today${date ? `?date=${encodeURIComponent(date)}` : ''}`, { token, skipCache: true }),
    attention: (token) => request('/follow-ups/attention-required', { token, skipCache: true }),
    analytics: (token, query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => value != null && value !== '' && params.set(key, value));
      return request(`/follow-ups/analytics${params.toString() ? `?${params}` : ''}`, { token, skipCache: true });
    },
    relatedSearch: (token, type, search = '') => request(`/follow-ups/related-search?type=${encodeURIComponent(type)}&search=${encodeURIComponent(search)}`, { token }),
    create: (token, payload) => request('/follow-ups', { method: 'POST', token, body: payload }),
    update: (token, id, payload) => request(`/follow-ups/${id}`, { method: 'PATCH', token, body: payload }),
    start: (token, id) => request(`/follow-ups/${id}/start`, { method: 'POST', token }),
    complete: (token, id, payload) => request(`/follow-ups/${id}/complete`, { method: 'POST', token, body: payload }),
    reschedule: (token, id, payload) => request(`/follow-ups/${id}/reschedule`, { method: 'POST', token, body: payload }),
    snooze: (token, id, payload) => request(`/follow-ups/${id}/snooze`, { method: 'POST', token, body: payload }),
    reassign: (token, id, payload) => request(`/follow-ups/${id}/reassign`, { method: 'POST', token, body: payload }),
    escalate: (token, id, payload = {}) => request(`/follow-ups/${id}/escalate`, { method: 'POST', token, body: payload }),
    acknowledge: (token, id) => request(`/follow-ups/${id}/acknowledge`, { method: 'POST', token }),
    remove: (token, id) => request(`/follow-ups/${id}`, { method: 'DELETE', token }),
    bulk: (token, payload) => request('/follow-ups/bulk', { method: 'POST', token, body: payload }),
    runAutomation: (token) => request('/follow-ups/automation/run', { method: 'POST', token }),
    getSettings: (token) => request('/follow-ups/settings', { token }),
    saveSettings: (token, payload) => request('/follow-ups/settings', { method: 'PUT', token, body: payload }),
    listConfig: (token, path) => request(path, { token }),
    createConfig: (token, path, payload) => request(path, { method: 'POST', token, body: payload }),
    updateConfig: (token, path, id, payload) => request(`${path}/${id}`, { method: 'PATCH', token, body: payload })
  },
  files: {
    list: (token, search = '', moduleName = '', entityId = '', folderKey = '') =>
      request(`/files?search=${search}&moduleName=${moduleName}&entityId=${entityId}&folderKey=${folderKey}`, { token, skipCache: true }),
    driveBrowse: (token, folderId = '') =>
      request(`/files/drive/browse?folderId=${folderId}`, { token, skipCache: true }),
    get: (token, id) => request(`/files/${id}`, { token, skipCache: true }),
    upload: (token, formData) => request('/files/upload', { method: 'POST', token, formData }),
    archive: (token, id) => request(`/files/${id}/archive`, { method: 'PATCH', token }),
    createFolder: (token, payload) => request('/files/drive/folder', { method: 'POST', token, body: payload }),
    renameDriveFile: (token, driveFileId, name) => request(`/files/drive/${driveFileId}/rename`, { method: 'PUT', token, body: { name } }),
    deleteDriveFile: (token, driveFileId) => request(`/files/drive/${driveFileId}`, { method: 'DELETE', token }),
    getUsage: (token) => request('/files/drive/usage', { token, skipCache: true })
  },
  resources: {
    list: (path, token, search = '', query = {}, options = {}) => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value == null || value === '') return;
        params.set(key, value);
      });
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return request(`${path}${suffix}`, { token, skipCache: options.skipCache ?? true });
    },
    get: (path, id, token, options = {}) => request(`${path}/${id}`, { token, skipCache: options.skipCache ?? true }),
    create: (path, payload, token) => {
      invalidateStoredCache(path);
      return request(path, { method: 'POST', body: payload, token });
    },
    update: (path, id, payload, token) => {
      invalidateStoredCache(path);
      return request(`${path}/${id}`, { method: 'PUT', body: payload, token });
    },
    remove: (path, id, token) => {
      invalidateStoredCache(path);
      return request(`${path}/${id}`, { method: 'DELETE', token });
    }
  },
  cache: {
    invalidate: (prefix = '') => invalidateStoredCache(prefix),
    clear: () => invalidateStoredCache('')
  }
};

export { API_BASE_URL };
