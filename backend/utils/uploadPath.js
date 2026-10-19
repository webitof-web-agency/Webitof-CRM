// Storage key layout, deterministic and browsable:
//   site/<file>                                   logos, watermarks, branding
//   <year>/<mon>/<section>/<record>/<file>        everything else (record optional)
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const IST_OFFSET_MS = 330 * 60 * 1000;

const SITE_MODULES = new Set(['settings', 'branding', 'logo', 'logos', 'watermark', 'site']);
const SECTION_ALIASES = {
  lead: 'leads',
  client: 'clients',
  project: 'projects',
  event: 'events',
  user: 'users',
  profile: 'users',
  avatar: 'users',
  avatars: 'users',
  call: 'calls',
  'call-logs': 'calls',
  recordings: 'calls',
  expense: 'expenses',
  'quotation-master': 'quotations',
  quotation: 'quotations',
  files: 'general',
  file: 'general'
};

function sanitizeSegment(value, fallback = '') {
  const clean = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.-]+|-+$/g, '')
    .slice(0, 80);
  return clean || fallback;
}

function istParts(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: String(ist.getUTCFullYear()),
    month: MONTHS[ist.getUTCMonth()],
    date: ist.toISOString().slice(0, 10),
    hour: ist.getUTCHours(),
    stamp: ist.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')
  };
}

function sectionFor(moduleName) {
  const normalized = sanitizeSegment(String(moduleName || '').toLowerCase(), 'general');
  return SECTION_ALIASES[normalized] || normalized;
}

function isSiteModule(moduleName) {
  return SITE_MODULES.has(String(moduleName || '').trim().toLowerCase());
}

function buildFolderPath({ moduleName = 'general', entityId = '', date = new Date() } = {}) {
  if (isSiteModule(moduleName)) return 'site';
  const { year, month } = istParts(date);
  const record = sanitizeSegment(entityId);
  return [year, month, sectionFor(moduleName), record].filter(Boolean).join('/');
}

function buildStorageKey({ moduleName, entityId, storedName, date } = {}) {
  return `${buildFolderPath({ moduleName, entityId, date })}/${storedName}`;
}

module.exports = {
  buildFolderPath,
  buildStorageKey,
  istParts,
  sanitizeSegment,
  sectionFor
};
