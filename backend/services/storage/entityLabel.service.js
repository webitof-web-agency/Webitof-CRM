// What an upload's Drive folder is named after: the record's number, name, own date and client.
// e.g. 02 Finance/Invoices/FY 2026-27/11-Nov/INV-2026-0012 - Acme (utils/uploadPath.js).
// Looked up on the server with fixed queries per section, so the browser can never choose a folder
// name. Any problem returns null and the upload falls back to the record-id folder.
const { sectionFor } = require('../../utils/uploadPath');

const CLIENT_NAME = "coalesce(nullif(c.company_name, ''), c.name)";

// section -> query returning (number, name, date, client_id, client_name); $1 is the record id.
const SOURCES = {
  leads: "select l.lead_number as number, coalesce(nullif(l.company_name, ''), l.name) as name, l.created_at as date from leads l where l.id = $1",
  clients: "select coalesce(nullif(company_name, ''), name) as name, created_at as date from clients where id = $1",
  projects: 'select title as name, coalesce(start_date, created_at::date) as date, client_id from projects where id = $1',
  'lead-events': 'select title as name, coalesce(start_date, created_at::date) as date from lead_events where id = $1',
  users: 'select full_name as name from users where id = $1',
  invoices: `select i.invoice_number as number, ${CLIENT_NAME} as name, coalesce(i.invoice_date, i.created_at::date) as date
    from invoices i left join clients c on c.id = i.client_id where i.id = $1`,
  payments: `select ${CLIENT_NAME} as name, coalesce(p.payment_date, p.created_at::date) as date
    from payments p left join clients c on c.id = p.client_id where p.id = $1`,
  expenses: `select concat_ws(' ', nullif(coalesce(nullif(e.vendor, ''), e.payee_name), ''), nullif(e.invoice_number, '')) as name,
    coalesce(e.expense_date, e.created_at::date) as date from expenses e where e.id = $1`,
  'credit-notes': `select n.credit_note_number as number, ${CLIENT_NAME} as name, coalesce(n.issue_date, n.created_at::date) as date
    from credit_notes n left join clients c on c.id = n.client_id where n.id = $1`,
  'lead-commissions': 'select partner_name as name, coalesce(commission_date, created_at::date) as date from lead_commissions where id = $1',
  outsourcing: `select concat_ws(' ', nullif(o.vendor_name, ''), nullif(o.work_type, '')) as name,
    coalesce(o.expense_date, o.created_at::date) as date from outsourcing_expenses o where o.id = $1`,
  amc: `select a.title as name, a.start_date as date, a.client_id, ${CLIENT_NAME} as client_name
    from amcs a left join clients c on c.id = a.client_id where a.id = $1`,
  renewals: `select coalesce(nullif(r.domain_name, ''), nullif(r.hosting_name, ''), nullif(r.package_name, ''), r.software_name) as name,
    r.renewal_date as date, r.client_id, ${CLIENT_NAME} as client_name
    from renewals r left join clients c on c.id = r.client_id where r.id = $1`
};

async function defaultLookup(section, id, sql) {
  const { query } = require('../../config/db');
  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

let lookup = defaultLookup;

// fn(section, id, sql) -> row | null
function setLabelLookupForTests(fn) {
  lookup = fn || defaultLookup;
}

function text(value) {
  return String(value ?? '').trim();
}

// { number, name, date, clientId, clientName } or null.
async function resolveEntityInfo(moduleName, entityId) {
  const section = sectionFor(moduleName);
  const sql = SOURCES[section];
  const id = text(entityId);
  if (!sql || !id) return null;
  try {
    const row = await lookup(section, id, sql);
    if (!row) return null;
    const info = {
      number: text(row.number),
      name: text(row.name),
      date: row.date || null,
      clientId: text(row.client_id),
      clientName: text(row.client_name)
    };
    return info.number || info.name || info.clientName ? info : null;
  } catch (error) {
    console.error(`Upload folder name lookup failed for ${section}:`, error.message);
    return null;
  }
}

// The record's readable name only (kept for callers that need just the label).
async function resolveEntityLabel(moduleName, entityId) {
  const info = await resolveEntityInfo(moduleName, entityId);
  return info ? info.number || info.name || null : null;
}

module.exports = {
  SOURCES,
  resolveEntityInfo,
  resolveEntityLabel,
  setLabelLookupForTests
};
