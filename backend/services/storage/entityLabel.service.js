// Human-readable name of the record an upload belongs to, used for its Drive folder
// (e.g. projects/Acme-Website-x8k2). Looked up on the server from a fixed table/column map,
// so the browser can never choose a folder name. Any problem returns null and the upload
// falls back to the record-id folder.
const { sectionFor } = require('../../utils/uploadPath');

// section → table and label columns. First non-empty column wins unless `join` is set.
const SOURCES = {
  projects: { table: 'projects', columns: ['title'] },
  clients: { table: 'clients', columns: ['company_name', 'name'] },
  leads: { table: 'leads', columns: ['company_name', 'name'] },
  users: { table: 'users', columns: ['full_name'] },
  'lead-events': { table: 'lead_events', columns: ['title'] },
  invoices: { table: 'invoices', columns: ['invoice_number'] },
  expenses: { table: 'expenses', columns: ['vendor', 'invoice_number'], join: true }
};

async function defaultLookup(table, columns, id) {
  const { query } = require('../../config/db');
  // table and columns come only from SOURCES above.
  const result = await query(`select ${columns.join(', ')} from ${table} where id = $1 limit 1`, [id]);
  return result.rows[0] || null;
}

let lookup = defaultLookup;

function setLabelLookupForTests(fn) {
  lookup = fn || defaultLookup;
}

async function resolveEntityLabel(moduleName, entityId) {
  const source = SOURCES[sectionFor(moduleName)];
  const id = String(entityId || '').trim();
  if (!source || !id) return null;
  try {
    const row = await lookup(source.table, source.columns, id);
    if (!row) return null;
    const values = source.columns.map((column) => String(row[column] || '').trim()).filter(Boolean);
    const label = source.join ? values.join(' ') : values[0];
    return label || null;
  } catch (error) {
    console.error(`Upload folder name lookup failed for ${source.table}:`, error.message);
    return null;
  }
}

module.exports = {
  resolveEntityLabel,
  setLabelLookupForTests
};
