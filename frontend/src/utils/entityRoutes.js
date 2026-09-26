const ROUTE_CONFIG = {
  leads: {
    base: '/app/leads',
    publicKey: 'leadNumber',
    labelKeys: ['companyName', 'name', 'contactPerson', 'leadNumber'],
    idPrefix: 'lead'
  },
  clients: {
    base: '/app/clients',
    labelKeys: ['companyName', 'name', 'contactPerson', 'email'],
    idPrefix: 'client'
  },
  projects: {
    base: '/app/projects',
    labelKeys: ['title', 'projectType', 'clientDisplayName', 'clientName'],
    idPrefix: 'project'
  },
  invoices: {
    base: '/app/invoices',
    publicKey: 'invoiceNumber',
    labelKeys: ['invoiceNumber', 'clientName', 'status'],
    idPrefix: 'invoice'
  },
  payments: {
    base: '/app/payments',
    labelKeys: ['transactionId', 'paymentMode', 'paymentStatus', 'paymentDate'],
    idPrefix: 'payment'
  },
  expenses: {
    base: '/app/expenses',
    labelKeys: ['invoiceNumber', 'payeeName', 'vendor', 'expenseType'],
    idPrefix: 'expense'
  },
  users: {
    base: '/app/users',
    labelKeys: ['fullName', 'username', 'email'],
    idPrefix: 'user'
  }
};

export function slugify(value, fallback = 'record') {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || fallback;
}

function pickValue(record = {}, keys = []) {
  for (const key of keys) {
    const value = record?.[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function shortId(id = '') {
  const value = String(id || '').trim();
  if (!value) return '';
  const [prefix, rest = ''] = value.split('_');
  if (!rest) return value.slice(0, 12);
  return `${prefix}_${rest.slice(0, 8)}`;
}

function routeSegment(type, recordOrId = {}) {
  if (typeof recordOrId === 'string') return encodeURIComponent(recordOrId);
  const config = ROUTE_CONFIG[type] || {};
  const publicToken = config.publicKey ? pickValue(recordOrId, [config.publicKey]) : '';
  const label = pickValue(recordOrId, config.labelKeys || []);
  const slug = slugify(label || publicToken || config.idPrefix || type);
  const tokenSlug = slugify(publicToken);

  if (publicToken) {
    if (!slug || slug === tokenSlug) {
      return encodeURIComponent(publicToken);
    }
    return encodeURIComponent(`${publicToken}-${slug}`);
  }

  const id = shortId(recordOrId?.id);
  if (!id) return encodeURIComponent(slug);
  const idSlug = slugify(id);
  if (!slug || slug === idSlug) {
    return encodeURIComponent(id);
  }
  return encodeURIComponent(`${slug}-${id}`);
}

export function entityRoute(type, recordOrId, suffix = '') {
  const config = ROUTE_CONFIG[type];
  if (!config) return '';
  const cleanSuffix = suffix ? `/${String(suffix).replace(/^\/+/, '')}` : '';
  return `${config.base}/${routeSegment(type, recordOrId)}${cleanSuffix}`;
}

export const leadRoute = (lead, suffix = '') => entityRoute('leads', lead, suffix);
export const clientRoute = (client, suffix = '') => entityRoute('clients', client, suffix);
export const projectRoute = (project, suffix = '') => entityRoute('projects', project, suffix);
export const invoiceRoute = (invoice, suffix = '') => entityRoute('invoices', invoice, suffix);
export const paymentRoute = (payment, suffix = '') => entityRoute('payments', payment, suffix);
export const expenseRoute = (expense, suffix = '') => entityRoute('expenses', expense, suffix);
export const userRoute = (user, suffix = '') => entityRoute('users', user, suffix);

export function canonicalRoute(type, recordOrId, currentPath = '', suffix = '') {
  const next = entityRoute(type, recordOrId, suffix);
  if (!next) return '';
  const normalizedCurrent = String(currentPath || '').replace(/\/+$/, '');
  return normalizedCurrent === next ? '' : next;
}

export function publicIdentifier(value = '') {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
}

export function publicToken(value = '') {
  const decoded = publicIdentifier(value).trim();
  if (!decoded) return '';
  if (decoded.includes('--')) {
    return decoded.split('--')[0].trim();
  }
  const prefixMatch = decoded.match(/^([A-Za-z]{2,5}-\d{4}-\d{4,8})(?:-(.*))?$/i);
  if (prefixMatch) {
    return prefixMatch[1].trim();
  }
  const idPrefixMatch = decoded.match(/^([a-z]+_[a-zA-Z0-9]+)(?:-(.*))?$/i);
  if (idPrefixMatch) {
    return idPrefixMatch[1].trim();
  }
  return decoded;
}

export function matchesRouteIdentifier(routeValue, record = {}, publicKeys = []) {
  const decoded = publicIdentifier(routeValue);
  const token = publicToken(decoded);
  let short = '';
  if (decoded.includes('--')) {
    short = decoded.split('--')[1] || '';
  } else {
    const m = decoded.match(/^[A-Za-z]{2,5}-\d{4}-\d{4,8}-(.*)$/i) || decoded.match(/^[a-z]+_[a-zA-Z0-9]+-(.*)$/i) || decoded.match(/^(?:.*)-([a-z]+_[a-zA-Z0-9]+)$/i);
    short = m ? m[1] : '';
  }

  if (String(record.id || '') === decoded || String(record.id || '') === token) return true;
  if (short && String(record.id || '').toLowerCase().startsWith(short.toLowerCase())) return true;
  return publicKeys.some((key) => {
    const value = record?.[key];
    return value && (String(value) === decoded || String(value) === token);
  });
}

export function eventRouteSegment(event = {}) {
  const label = event.title || event.eventType || 'event';
  const id = shortId(event.id);
  return encodeURIComponent(id ? `${slugify(label, 'event')}-${id}` : slugify(label, 'event'));
}
