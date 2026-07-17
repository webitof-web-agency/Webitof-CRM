const { createId, deepClone, isTruthy, nowIso, toCamelCase, toNumber } = require('../utils/format');
const { query } = require('../config/db');

function column(definition) {
  return {
    key: definition.key,
    db: definition.db || definition.key,
    type: definition.type || 'string',
    nullable: definition.nullable !== false
  };
}

function normalizeForDb(value, type) {
  if (type === 'number') {
    if (value === '' || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (type === 'boolean') {
    return isTruthy(value);
  }
  if (type === 'date') {
    if (value == null || value === '') return null;
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const raw = String(value).trim();
    return raw ? raw.slice(0, 10) : null;
  }
  if (type === 'json') {
    return value == null ? '{}' : (typeof value === 'string' ? value : JSON.stringify(value));
  }
  if (value == null) return null;
  return String(value);
}

function hydrateRow(row, columns) {
  if (!row) return null;
  const payload = row.payload || {};
  const record = { ...payload };

  columns.forEach((col) => {
    if (Object.prototype.hasOwnProperty.call(row, col.db)) {
      const value = row[col.db];
      record[col.key] = value == null ? null : value;
    }
  });

  record.id = row.id;
  record.createdAt = row.created_at;
  record.updatedAt = row.updated_at;
  return record;
}

function splitRecord(record = {}, columns = []) {
  const source = deepClone(record) || {};
  const row = {};
  const payload = { ...(source.payload || {}) };

  delete source.id;
  delete source.createdAt;
  delete source.updatedAt;
  delete source.payload;

  columns.forEach((col) => {
    if (Object.prototype.hasOwnProperty.call(source, col.key)) {
      row[col.db] = normalizeForDb(source[col.key], col.type);
      delete source[col.key];
    }
  });

  Object.assign(payload, source);
  row.payload = payload;
  return row;
}

function createRepository({
  table,
  idPrefix,
  columns = [],
  searchColumns = []
}) {
  const lookup = new Map();
  columns.forEach((col) => {
    lookup.set(col.key, col);
    lookup.set(col.db, col);
  });

  function resolveColumn(key) {
    return lookup.get(key) || null;
  }

  async function list({ where = {}, search, orderBy = 'updated_at DESC' } = {}) {
    const clauses = [];
    const values = [];

    Object.entries(where).forEach(([key, value]) => {
      if (value == null || value === '') return;
      const col = resolveColumn(key);
      if (!col) return;
      values.push(normalizeForDb(value, col.type));
      clauses.push(`${col.db} = $${values.length}`);
    });

    if (search && searchColumns.length) {
      values.push(`%${String(search).toLowerCase()}%`);
      const idx = values.length;
      clauses.push(`(${searchColumns.map((col) => `lower(coalesce(${col}, '')) like $${idx}`).join(' OR ')})`);
    }

    const sql = `select * from ${table}${clauses.length ? ` where ${clauses.join(' and ')}` : ''} order by ${orderBy}`;
    const result = await query(sql, values);
    return result.rows.map((row) => hydrateRow(row, columns));
  }

  async function findById(id, dbClient = null) {
    if (!id) return null;
    const exec = dbClient?.query || query;
    const result = await exec.call(dbClient || null, `select * from ${table} where id = $1 limit 1`, [id]);
    return hydrateRow(result.rows[0], columns);
  }

  async function count(where = {}) {
    const clauses = [];
    const values = [];
    Object.entries(where).forEach(([key, value]) => {
      if (value == null || value === '') return;
      const col = resolveColumn(key);
      if (!col) return;
      values.push(normalizeForDb(value, col.type));
      clauses.push(`${col.db} = $${values.length}`);
    });
    const sql = `select count(*)::int as count from ${table}${clauses.length ? ` where ${clauses.join(' and ')}` : ''}`;
    const result = await query(sql, values);
    return Number(result.rows[0]?.count || 0);
  }

  async function create(data = {}, dbClient = null) {
    const record = splitRecord(data, columns);
    const id = data.id || createId(idPrefix || table);
    const createdAt = nowIso();
    const updatedAt = createdAt;
    const insertRow = { id, created_at: createdAt, updated_at: updatedAt, ...record };
    const keys = Object.keys(insertRow);
    const values = Object.values(insertRow);
    const placeholders = keys.map((_, index) => `$${index + 1}`);
    const sql = `insert into ${table} (${keys.join(', ')}) values (${placeholders.join(', ')}) returning *`;
    const exec = dbClient?.query || query;
    const result = await exec.call(dbClient || null, sql, values);
    return hydrateRow(result.rows[0], columns);
  }

  async function update(id, patch = {}, dbClient = null) {
    const current = await findById(id, dbClient);
    if (!current) return null;
    const merged = { ...current, ...patch, id };
    const record = splitRecord(merged, columns);
    record.updated_at = nowIso();
    const keys = Object.keys(record);
    const values = Object.values(record);
    values.push(id);
    const assignments = keys.map((key, index) => `${key} = $${index + 1}`);
    const sql = `update ${table} set ${assignments.join(', ')} where id = $${values.length} returning *`;
    const exec = dbClient?.query || query;
    const result = await exec.call(dbClient || null, sql, values);
    return hydrateRow(result.rows[0], columns);
  }

  async function remove(id, dbClient = null) {
    const exec = dbClient?.query || query;
    const result = await exec.call(dbClient || null, `delete from ${table} where id = $1 returning id`, [id]);
    return result.rowCount > 0;
  }

  async function upsert(data = {}) {
    if (!data.id) return create(data);
    const existing = await findById(data.id);
    return existing ? update(data.id, data) : create(data);
  }

  return {
    columns,
    count,
    create,
    findById,
    hydrateRow: (row) => hydrateRow(row, columns),
    list,
    remove,
    resolveColumn,
    splitRecord: (record) => splitRecord(record, columns),
    upsert,
    update
  };
}

module.exports = {
  column,
  createRepository,
  hydrateRow,
  normalizeForDb,
  splitRecord
};
