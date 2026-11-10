// Storage key layout, deterministic and browsable:
//   site/<file>                                   logos, watermarks, branding
//   <year>/<mon>/<section>/<record>/<file>        everything else (record optional)
// <record> is "<Readable-Name>-<last 4 of id>" when the record's name is known, else the id.
// The name is fixed at upload time; renaming the record later does not move old files.
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

function recordFolder(entityId, entityLabel) {
  const id = sanitizeSegment(entityId);
  if (!id) return '';
  const label = sanitizeSegment(entityLabel).slice(0, 50).replace(/[.-]+$/, '');
  if (!label) return id;
  const shortId = String(entityId).replace(/[^A-Za-z0-9]/g, '').slice(-4);
  return shortId ? `${label}-${shortId}` : label;
}

function buildFolderPath({ moduleName = 'general', entityId = '', entityLabel = '', date = new Date() } = {}) {
  if (isSiteModule(moduleName)) return 'site';
  const { year, month } = istParts(date);
  return [year, month, sectionFor(moduleName), recordFolder(entityId, entityLabel)].filter(Boolean).join('/');
}

function buildStorageKey({ moduleName, entityId, entityLabel, storedName, date } = {}) {
  return `${buildFolderPath({ moduleName, entityId, entityLabel, date })}/${storedName}`;
}

// One folder per employee for all their HR documents: hrm/employees/Mallika-Paik-EMP-12.
// The employee number keeps two people with the same name apart.
function employeeFolder({ fullName = '', employeeNumber = '', id = '' } = {}) {
  const name = sanitizeSegment(String(fullName).replace(/\s+/g, '-')).slice(0, 60).replace(/[.-]+$/, '');
  const number = sanitizeSegment(employeeNumber || id);
  return `hrm/employees/${[name, number].filter(Boolean).join('-') || 'unknown'}`;
}

module.exports = {
  buildFolderPath,
  buildStorageKey,
  employeeFolder,
  isSiteModule,
  istParts,
  sanitizeSegment,
  sectionFor
};
