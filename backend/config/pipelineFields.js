// Statuses and sources for leads, clients and projects (Settings → Custom Fields).
// The lists below are built in: fixed in code, always shown first, never stored and not editable
// from the app. Admins add their own values in Settings → Custom Fields; only those custom values
// are stored (app_settings.statuses / .sources) and they are shown after these.
// Lead status `state`: 'won' marks a won deal (used when converting a lead), 'lost' a lost one.
const PIPELINE_STATUSES = Object.freeze({
  leads: [
    { label: 'New', color: '#2563eb', state: 'open' },
    { label: 'Contacted', color: '#6366f1', state: 'open' },
    { label: 'Requirement Collected', color: '#0891b2', state: 'open' },
    { label: 'Qualified', color: '#8b5cf6', state: 'open' },
    { label: 'Unqualified', color: '#f43f5e', state: 'open' },
    { label: 'Quotation Pending', color: '#ea580c', state: 'open' },
    { label: 'Quotation Sent', color: '#9333ea', state: 'open' },
    { label: 'Negotiation', color: '#db2777', state: 'open' },
    { label: 'Follow-up', color: '#0284c7', state: 'open' },
    { label: 'Demo Scheduled', color: '#f59e0b', state: 'open' },
    { label: 'Meeting Scheduled', color: '#4f46e5', state: 'open' },
    { label: 'On Hold', color: '#d97706', state: 'open' },
    { label: 'Won', color: '#16a34a', state: 'won' },
    { label: 'Lost', color: '#dc2626', state: 'lost' },
    { label: 'Not Interested', color: '#e11d48', state: 'lost' },
    { label: 'Invalid Lead', color: '#64748b', state: 'lost' },
    { label: 'Duplicate', color: '#6b7280', state: 'lost' }
  ],
  clients: [
    { label: 'Active', color: '#10b981' },
    { label: 'Inactive', color: '#64748b' }
  ],
  // Delivery order: start → work → blockers → launch → after launch → closed. Names are stored on
  // each project as they are, so never rename an existing one.
  // `phase` drives the counts in dashboards and reports: 'open' (active), 'completed', 'cancelled'.
  projects: [
    { label: 'Not Started', color: '#64748b', phase: 'open' },
    { label: 'Requirement Gathering', color: '#0ea5e9', phase: 'open' },
    { label: 'Awaiting Advance', color: '#f97316', phase: 'open' },
    { label: 'Planning', color: '#6366f1', phase: 'open' },
    { label: 'Design', color: '#d946ef', phase: 'open' },
    { label: 'In Progress', color: '#3b82f6', phase: 'open' },
    { label: 'Content Pending', color: '#eab308', phase: 'open' },
    { label: 'Testing / QA', color: '#8b5cf6', phase: 'open' },
    { label: 'Client Review', color: '#06b6d4', phase: 'open' },
    { label: 'Revisions', color: '#ec4899', phase: 'open' },
    { label: 'On Hold', color: '#f59e0b', phase: 'open' },
    { label: 'Waiting on Client', color: '#fb923c', phase: 'open' },
    { label: 'Payment Pending', color: '#ef4444', phase: 'open' },
    { label: 'Ready for Launch', color: '#14b8a6', phase: 'open' },
    { label: 'Live', color: '#22c55e', phase: 'completed' },
    { label: 'Completed', color: '#10b981', phase: 'completed' },
    { label: 'Support / Warranty', color: '#0891b2', phase: 'completed' },
    { label: 'Handed Over', color: '#475569', phase: 'completed' },
    { label: 'AMC', color: '#7c3aed', phase: 'completed' },
    { label: 'Cancelled', color: '#dc2626', phase: 'cancelled' },
    { label: 'Closed', color: '#334155', phase: 'completed' }
  ]
});

// Grouped for reading; the app shows them in this order. Keep "Other" last. Names are stored on
// each lead as they are, so never rename an existing one.
const PIPELINE_SOURCES = Object.freeze({
  leads: [
    // Website & search
    'Website',
    'Website Contact Form',
    'Landing Page',
    'Live Chat',
    'Chatbot',
    'Google Search (SEO)',
    'Google Ads',
    'Google Business Profile',
    'Bing Ads',
    // Social media
    'Facebook',
    'Facebook Ads',
    'Instagram',
    'Instagram Ads',
    'LinkedIn',
    'LinkedIn Ads',
    'YouTube',
    'X (Twitter)',
    'Quora',
    'Pinterest',
    // Messaging & calls
    'WhatsApp',
    'WhatsApp Business',
    'Telegram',
    'SMS',
    'Phone Call',
    'Inbound Call',
    'Missed Call',
    'Cold Call',
    'Email',
    'Email Campaign',
    'Newsletter',
    // Marketplaces & directories
    'IndiaMART',
    'Justdial',
    'TradeIndia',
    'Sulekha',
    'ExportersIndia',
    'Clutch',
    'GoodFirms',
    'Directory Listing',
    // Freelance platforms
    'Upwork',
    'Freelancer',
    'Fiverr',
    'Guru',
    'PeoplePerHour',
    'Toptal',
    // Referrals & partners
    'Referral',
    'Existing Client',
    'Repeat Client',
    'Employee Reference',
    'Partner',
    'Channel Partner',
    'Reseller',
    'Affiliate',
    // Events & offline
    'Walk-in',
    'Event / Exhibition',
    'Trade Show',
    'Seminar / Webinar',
    'Workshop',
    'Networking Event',
    'Business Card',
    'Newspaper / Print Ad',
    'Radio / TV',
    'Hoarding / Outdoor',
    'Pamphlet / Flyer',
    // Tenders
    'Government Tender',
    'GeM Portal',
    'Other'
  ]
});

const STATUS_MODULES = ['leads', 'clients', 'projects'];
const SOURCE_MODULES = ['leads'];
const STATES = new Set(['open', 'won', 'lost']);
const PHASES = new Set(['open', 'completed', 'cancelled']);
// Statuses older versions offered for projects outside the configured list.
const LEGACY_PROJECT_PHASES = { active: 'open', paused: 'open', archived: 'completed', cancelled: 'cancelled', completed: 'completed' };
const MAX_LABEL = 60;
const MAX_CUSTOM = 50;

const labelOf = (item) => String((typeof item === 'string' ? item : item?.label) || '').trim();
const keyOf = (label) => label.toLowerCase();

function cleanLabel(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LABEL);
}

function cleanColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '#64748b';
}

// Custom values only: cleaned, without built-in or repeated labels, at most MAX_CUSTOM per list.
function customStatuses(module, items) {
  const builtIn = new Set((PIPELINE_STATUSES[module] || []).map((item) => keyOf(item.label)));
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(items) ? items : []) {
    const label = cleanLabel(labelOf(item));
    if (!label || builtIn.has(keyOf(label)) || seen.has(keyOf(label))) continue;
    seen.add(keyOf(label));
    const entry = { label, color: cleanColor(item?.color) };
    if (module === 'leads') entry.state = STATES.has(item?.state) ? item.state : 'open';
    if (module === 'projects') entry.phase = PHASES.has(item?.phase) ? item.phase : 'open';
    result.push(entry);
    if (result.length >= MAX_CUSTOM) break;
  }
  return result;
}

function customSources(module, items) {
  const builtIn = new Set((PIPELINE_SOURCES[module] || []).map((label) => keyOf(label)));
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(items) ? items : []) {
    const label = cleanLabel(labelOf(item));
    if (!label || builtIn.has(keyOf(label)) || seen.has(keyOf(label))) continue;
    seen.add(keyOf(label));
    result.push(label);
    if (result.length >= MAX_CUSTOM) break;
  }
  return result;
}

// What is stored: only the custom values, per module.
function customOnly({ statuses = {}, sources = {} } = {}) {
  return {
    statuses: Object.fromEntries(STATUS_MODULES.map((module) => [module, customStatuses(module, statuses?.[module])])),
    sources: Object.fromEntries(SOURCE_MODULES.map((module) => [module, customSources(module, sources?.[module])]))
  };
}

// What the app sees: built-in values first, then the stored custom ones (marked custom: true).
// Lead sources stay plain strings, as every form expects; customSources lists which are custom.
function pipelineSettings(stored = {}) {
  const custom = customOnly(stored);
  return {
    statuses: Object.fromEntries(STATUS_MODULES.map((module) => [
      module,
      [...PIPELINE_STATUSES[module].map((item) => ({ ...item })), ...custom.statuses[module].map((item) => ({ ...item, custom: true }))]
    ])),
    sources: Object.fromEntries(SOURCE_MODULES.map((module) => [module, [...PIPELINE_SOURCES[module], ...custom.sources[module]]])),
    customSources: custom.sources
  };
}

// 'open' | 'completed' | 'cancelled' for a project status: the configured list (built-in and
// custom, from settings) first, then the legacy names; anything unknown counts as open.
function projectPhase(status, settings = null) {
  const label = String(status || '').trim().toLowerCase();
  const configured = settings?.statuses?.projects || PIPELINE_STATUSES.projects;
  const match = configured.find((item) => labelOf(item).toLowerCase() === label);
  if (match && PHASES.has(match.phase)) return match.phase;
  return LEGACY_PROJECT_PHASES[label] || 'open';
}

function countProjectsByPhase(projects = [], settings = null) {
  const counts = { open: 0, completed: 0, cancelled: 0 };
  for (const project of projects) counts[projectPhase(project?.status, settings)] += 1;
  return counts;
}

module.exports = {
  PIPELINE_SOURCES,
  PIPELINE_STATUSES,
  countProjectsByPhase,
  customOnly,
  pipelineSettings,
  projectPhase
};
