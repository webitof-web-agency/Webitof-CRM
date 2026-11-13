// Storage key layout, by category, deterministic and browsable (same on local disk and in Drive,
// where it sits inside the uploads folder):
//   Site/<file>                                         logos, watermarks, branding
//   Users/<record>/<file>                               profile photos
//   HRM/Employees/<Name>-<EMP-no>/<file>                HR documents (employeeFolder)
//   <Category>/<Section>/<record>/<file>                CRM, Services, Finance, General ...
//   <Category>/<Section>/<year>/<MM-Mon>/<file>         when there is no record
// <record> is "<Readable-Name>-<last 4 of id>" when the record's name is known, else the id.
// The name is fixed at upload time; renaming the record later does not move old files.
// Files uploaded before this layout keep their old keys (<year>/<mon>/..., site/, hrm/...).
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
  file: 'general',
  employee: 'employees',
  'credit-note': 'credit-notes',
  creditnotes: 'credit-notes',
  invoice: 'invoices',
  payment: 'payments',
  renewal: 'renewals'
};

// Top-level folders, one per ERP area. A section not listed here goes to General.
const CATEGORIES = {
  CRM: ['leads', 'lead-events', 'clients', 'projects', 'events', 'calls', 'quotations', 'follow-ups'],
  Services: ['amc', 'renewals'],
  Finance: ['invoices', 'payments', 'expenses', 'credit-notes', 'lead-commissions', 'outsourcing'],
  HRM: ['hrm', 'employees'],
  Users: ['users']
};
// Categories with a single section skip the section level.
const FLAT_CATEGORIES = new Set(['Users']);
const SITE_FOLDER = 'Site';
const CATEGORY_FOLDERS = [...Object.keys(CATEGORIES), 'General', SITE_FOLDER];
const SECTION_LABELS = { amc: 'AMC', hrm: 'Files', general: 'Files' };

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
    // "11-Nov": sorts in calendar order in Drive and on disk.
    monthFolder: `${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${MONTH_LABELS[ist.getUTCMonth()]}`,
    date: ist.toISOString().slice(0, 10),
    hour: ist.getUTCHours(),
    stamp: ist.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')
  };
}

function sectionFor(moduleName) {
  const normalized = sanitizeSegment(String(moduleName || '').toLowerCase(), 'general');
  return SECTION_ALIASES[normalized] || normalized;
}

function categoryFor(section) {
  return Object.keys(CATEGORIES).find((category) => CATEGORIES[category].includes(section)) || 'General';
}

// "lead-events" → "Lead-Events", "amc" → "AMC".
function sectionLabel(section) {
  if (SECTION_LABELS[section]) return SECTION_LABELS[section];
  return section.split('-').filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join('-') || 'Files';
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
  if (isSiteModule(moduleName)) return SITE_FOLDER;
  const section = sectionFor(moduleName);
  const category = categoryFor(section);
  const record = recordFolder(entityId, entityLabel);
  const parts = FLAT_CATEGORIES.has(category) ? [category] : [category, sectionLabel(section)];
  if (record) parts.push(record);
  else {
    const { year, monthFolder } = istParts(date);
    parts.push(year, monthFolder);
  }
  return parts.join('/');
}

function buildStorageKey({ moduleName, entityId, entityLabel, storedName, date } = {}) {
  return `${buildFolderPath({ moduleName, entityId, entityLabel, date })}/${storedName}`;
}

// One folder per employee for all their HR documents: HRM/Employees/Mallika-Paik-EMP-12.
// The employee number keeps two people with the same name apart.
const EMPLOYEE_FOLDER_ROOT = 'HRM/Employees';

function employeeFolder({ fullName = '', employeeNumber = '', id = '' } = {}) {
  const name = sanitizeSegment(String(fullName).replace(/\s+/g, '-')).slice(0, 60).replace(/[.-]+$/, '');
  const number = sanitizeSegment(employeeNumber || id);
  return `${EMPLOYEE_FOLDER_ROOT}/${[name, number].filter(Boolean).join('-') || 'unknown'}`;
}

module.exports = {
  CATEGORY_FOLDERS,
  EMPLOYEE_FOLDER_ROOT,
  buildFolderPath,
  buildStorageKey,
  employeeFolder,
  isSiteModule,
  categoryFor,
  istParts,
  sanitizeSegment,
  sectionFor
};
