// Where clicking a notification should take the user (an in-app path, or '' when there is nowhere to go).
// The backend stores route_path; older rows may only have module + entity, so those are rebuilt here.
const BY_MODULE = {
  clients: (id) => `/app/clients/${id}`,
  projects: (id) => `/app/projects/${id}`,
  invoices: (id) => `/app/invoices/${id}`,
  payments: (id) => `/app/payments/${id}`,
  expenses: (id) => `/app/expenses/${id}`,
  leads: (id) => `/app/leads/${id}`,
  amc: (id) => `/app/amc/${id}`,
  followups: (id) => (id ? `/app/follow-ups?focus=${id}` : '/app/follow-ups'),
  todos: (id) => (id ? `/app/todos?focus=${id}` : '/app/todos'),
  calendar: () => '/app/profile',
  outsourcing: () => '/app/outsourcing',
  renewals: () => '/app/renewals',
  'lead-commissions': () => '/app/lead-commissions',
  hrm: () => '/app/hrm',
  settings: () => '/app/settings'
};

// These modules have a list page but no detail page, so /app/<module>/<id> would be a 404.
const LIST_ONLY = new Set(['outsourcing', 'renewals', 'lead-commissions', 'banking', 'users', 'roles']);

export function notificationTarget(item = {}) {
  let path = String(item.routePath || item.payload?.routePath || '').trim();
  // Absolute links (https://erp.example.com/#/app/...) keep only the in-app part.
  if (/^https?:\/\//i.test(path)) {
    const hash = path.indexOf('#');
    path = hash >= 0 ? path.slice(hash + 1) : '';
  }
  if (path.startsWith('#')) path = path.slice(1);
  if (!path) {
    const build = BY_MODULE[item.moduleName];
    path = build ? build(String(item.entityId || '').trim()) : '';
  }
  if (!path.startsWith('/app')) return '';
  // "/app/leads/" (record id missing) becomes the list page.
  path = path.replace(/\/+(?=\?|$)/, '');
  // Plain "/app/hrm" (older HRM notifications) is the overview, so the Overview sub-menu counts it.
  if (path === '/app/hrm') return '/app/hrm/overview';
  const detail = path.match(/^\/app\/([a-z-]+)\/[^?]+/);
  if (detail && LIST_ONLY.has(detail[1])) return `/app/${detail[1]}`;
  return path;
}
