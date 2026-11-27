// Storage key layout: one tree under the "Webitof ERP Data" folder in Drive (the same keys are
// used on the local disk). Numbered top folders keep the ERP menu order:
//
//   01 CRM/Leads/LD-2026-000017 - Vashi Tech/<file>           record with a number
//   01 CRM/Clients/Acme Pvt Ltd (c91d)/<file>                 record without a number: name (last 4 of id)
//   01 CRM/Calls/+919876543210 - Vashi Tech/<file>            recordings: one folder per number
//                                                             (callFolder; year / month without one)
//   01 CRM/Quotations/FY 2026-27/11-Nov/<file>
//   02 Finance/Invoices/FY 2026-27/11-Nov/INV-2026-0012 - Acme/<file>
//                                                             finance: financial year (Apr-Mar) and month
//                                                             of the record's own date, then the record
//   03 Services/AMC/Acme Pvt Ltd (c91d)/<file>                AMC and renewals: one folder per client
//   04 HRM/Employees/EMP-012 - Mallika Paik/Documents/<file>  HR documents (employeeFolder)
//   05 Users/Hitesh Kumar (ab12)/<file>                       profile photos
//   06 Company/<file>                                         logo, watermark, certificates
//   07 General/2026/11-Nov/<file>
//
// Without a record, a section files by year (or FY) and month of the upload date.
// File names are "<YYYY-MM-DD>_<original-name>" (calls add the time), see file.service.js.
// A record keeps the folder of its first upload, so renaming it later does not split its files.
// Files uploaded under earlier layouts keep their keys (CRM/..., <year>/<mon>/..., site, hrm/...).
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
  renewal: 'renewals',
  'follow-up': 'follow-ups',
  followups: 'follow-ups'
};

// Top-level folders, one per ERP area. A section not listed here goes to General.
const CATEGORIES = {
  '01 CRM': ['leads', 'lead-events', 'clients', 'projects', 'events', 'calls', 'quotations', 'follow-ups'],
  '02 Finance': ['invoices', 'payments', 'expenses', 'credit-notes', 'lead-commissions', 'outsourcing'],
  '03 Services': ['amc', 'renewals'],
  '04 HRM': ['hrm', 'employees'],
  '05 Users': ['users']
};
const GENERAL_FOLDER = '07 General';
const SITE_FOLDER = '06 Company';
// Created as soon as Google Drive is connected, so the tree is there before the first upload.
const CATEGORY_FOLDERS = [...Object.keys(CATEGORIES), SITE_FOLDER, GENERAL_FOLDER];
// Top folders of the earlier layout; their files are still listed as they are.
const LEGACY_CATEGORY_FOLDERS = ['CRM', 'Services', 'Finance', 'HRM', 'Users', 'General', 'Site'];

const SECTION_LABELS = {
  amc: 'AMC',
  hrm: 'Files',
  general: 'Files',
  'lead-events': 'Lead Events',
  'credit-notes': 'Credit Notes',
  'lead-commissions': 'Lead Commissions',
  'follow-ups': 'Follow-ups'
};
// Categories with a single section skip the section level.
const FLAT_CATEGORIES = new Set(['05 Users']);
// Year/month only, even when the upload names a record (recordings come in by the hundred).
const DATED_SECTIONS = new Set(['calls', 'quotations']);
// Grouped by financial year (Apr-Mar) instead of calendar year.
const FY_SECTIONS = new Set(['quotations', ...CATEGORIES['02 Finance']]);
// One folder per client instead of per record.
const CLIENT_SECTIONS = new Set(['amc', 'renewals']);

// Storage-key segment for code values (ids, numbers): letters, digits, ".", "_" and "-" only.
function sanitizeSegment(value, fallback = '') {
  const clean = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.-]+|-+$/g, '')
    .slice(0, 80);
  return clean || fallback;
}

// Folder name a person reads in Drive: keeps spaces and ( ) & , but nothing a file system or
// Drive search would trip on; never "/" so it stays one path segment.
function displaySegment(value, max = 60) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .,&()_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .replace(/[\s.,-]+$/, '')
    .replace(/^[\s.,-]+/, '');
}

function toDate(value, fallback) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function istParts(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const monthIndex = ist.getUTCMonth();
  const year = ist.getUTCFullYear();
  const fyStart = monthIndex >= 3 ? year : year - 1;
  return {
    year: String(year),
    month: MONTHS[monthIndex],
    // "11-Nov": sorts in calendar order in Drive and on disk.
    monthFolder: `${String(monthIndex + 1).padStart(2, '0')}-${MONTH_LABELS[monthIndex]}`,
    // Indian financial year, April to March: "FY 2026-27".
    fyFolder: `FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`,
    date: ist.toISOString().slice(0, 10),
    time: ist.toISOString().slice(11, 16).replace(':', '-'),
    hour: ist.getUTCHours(),
    stamp: ist.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')
  };
}

function sectionFor(moduleName) {
  const normalized = sanitizeSegment(String(moduleName || '').toLowerCase(), 'general');
  return SECTION_ALIASES[normalized] || normalized;
}

function categoryFor(section) {
  return Object.keys(CATEGORIES).find((category) => CATEGORIES[category].includes(section)) || GENERAL_FOLDER;
}

// "lead-events" -> "Lead Events", "amc" -> "AMC".
function sectionLabel(section) {
  if (SECTION_LABELS[section]) return SECTION_LABELS[section];
  return section.split('-').filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ') || 'Files';
}

function isSiteModule(moduleName) {
  return SITE_MODULES.has(String(moduleName || '').trim().toLowerCase());
}

// Sections whose uploads go in one folder per record (not by date, not by client).
function isRecordFolderSection(moduleName) {
  if (isSiteModule(moduleName)) return false;
  const section = sectionFor(moduleName);
  return !DATED_SECTIONS.has(section) && !CLIENT_SECTIONS.has(section);
}

function shortIdOf(id) {
  return String(id || '').replace(/[^A-Za-z0-9]/g, '').slice(-4);
}

// "LD-2026-000017 - Vashi Tech" when the record has a number, else "Vashi Tech (x8k2)", else the id.
function recordFolder(entityId, { number = '', name = '' } = {}) {
  const num = sanitizeSegment(number).slice(0, 30);
  const label = displaySegment(name, 50);
  if (num) return label ? `${num} - ${label}` : num;
  if (label) {
    const shortId = shortIdOf(entityId);
    return shortId ? `${label} (${shortId})` : label;
  }
  return sanitizeSegment(entityId);
}

// entity: what the server looked up about the record (entityLabel.service): { number, name, date,
// clientId, clientName }. A plain string is taken as the name (older callers).
function buildFolderPath({ moduleName = 'general', entityId = '', entity = null, entityLabel = '', date = new Date() } = {}) {
  if (isSiteModule(moduleName)) return SITE_FOLDER;
  const info = entity || (entityLabel ? { name: entityLabel } : {});
  const section = sectionFor(moduleName);
  const category = categoryFor(section);
  const parts = FLAT_CATEGORIES.has(category) ? [category] : [category, sectionLabel(section)];

  const uploadDate = toDate(date, new Date());
  if (FY_SECTIONS.has(section)) {
    // Finance files sit under the year and month of the record's own date (invoice date, payment
    // date ...), so every file of one record stays in one folder.
    const { fyFolder, monthFolder } = istParts(toDate(info.date, uploadDate));
    parts.push(fyFolder, monthFolder);
    const record = DATED_SECTIONS.has(section) ? '' : recordFolder(entityId, info);
    if (record) parts.push(record);
    return parts.join('/');
  }

  if (CLIENT_SECTIONS.has(section) && info.clientName) {
    parts.push(recordFolder(info.clientId, { name: info.clientName }));
    return parts.join('/');
  }

  const record = DATED_SECTIONS.has(section) ? '' : recordFolder(entityId, info);
  if (record) parts.push(record);
  else {
    const { year, monthFolder } = istParts(uploadDate);
    parts.push(year, monthFolder);
  }
  return parts.join('/');
}

function buildStorageKey({ moduleName, entityId, entity, entityLabel, storedName, date } = {}) {
  return `${buildFolderPath({ moduleName, entityId, entity, entityLabel, date })}/${storedName}`;
}

// Call recordings: one folder per phone number, every recording named after the call.
//   01 CRM/Calls/+919876543210 - Vashi Tech/+919876543210 - Vashi Tech - 2026-11-27 10-32 - 3m 25s.mp3
const CALLS_FOLDER_ROOT = '01 CRM/Calls';

// One form per number so "98765 43210", "+91 98765-43210" and "919876543210" share a folder.
function normalizeCallPhone(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return raw.startsWith('+') ? `+${digits}` : digits;
}

function callContactLabel({ phone = '', name = '' } = {}) {
  const number = normalizeCallPhone(phone);
  const cleanName = displaySegment(name, 50);
  // "Customer" / "Unknown" are what the app sends when it has no name.
  const usefulName = /^(customer|unknown|direct call)$/i.test(cleanName) ? '' : cleanName;
  return [number || 'Unknown Number', usefulName].filter(Boolean).join(' - ');
}

function callFolder({ phone = '', name = '' } = {}) {
  return `${CALLS_FOLDER_ROOT}/${callContactLabel({ phone, name })}`;
}

// "3m 25s", "1h 02m 10s", "45s"; '' when the duration is unknown.
function formatCallDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (!total) return '';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

// "<number> - <name> - <YYYY-MM-DD HH-mm> - <duration>" (India time; "-" because ":" is not allowed in file names).
function callFileBase({ phone = '', name = '', startedAt = null, durationSeconds = 0 } = {}) {
  const { date, time } = istParts(toDate(startedAt, new Date()));
  return [callContactLabel({ phone, name }), `${date} ${time}`, formatCallDuration(durationSeconds)].filter(Boolean).join(' - ');
}

// One folder per employee for all their HR documents:
// 04 HRM/Employees/EMP-012 - Mallika Paik/Documents. The employee number keeps two people with the
// same name apart and sorts the list.
const EMPLOYEE_FOLDER_ROOT = '04 HRM/Employees';

function employeeFolder({ fullName = '', employeeNumber = '', id = '' } = {}) {
  const name = displaySegment(fullName, 60);
  const number = sanitizeSegment(employeeNumber || id);
  const folder = [number, name].filter(Boolean).join(' - ') || 'unknown';
  return `${EMPLOYEE_FOLDER_ROOT}/${folder}/Documents`;
}

module.exports = {
  CALLS_FOLDER_ROOT,
  CATEGORY_FOLDERS,
  callFileBase,
  callFolder,
  formatCallDuration,
  normalizeCallPhone,
  EMPLOYEE_FOLDER_ROOT,
  LEGACY_CATEGORY_FOLDERS,
  buildFolderPath,
  buildStorageKey,
  displaySegment,
  employeeFolder,
  isRecordFolderSection,
  isSiteModule,
  categoryFor,
  istParts,
  sanitizeSegment,
  sectionFor
};
