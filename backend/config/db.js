const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');
require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  override: false
});

// Keep DATE columns as plain strings so calendar dates do not shift by timezone.
types.setTypeParser(1082, (value) => value);

const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: String(process.env.DB_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'webitof_crm',
      ssl: String(process.env.DB_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false
    };

const pool = new Pool(connectionConfig);

pool.on('error', (error) => {
  console.error('Unexpected database pool error:', error);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function testConnection() {
  await query('select now() as server_time');
}

async function runSqlFile(sqlFilePath) {
  const raw = fs.readFileSync(sqlFilePath, 'utf8');
  const statements = raw
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await query(statement);
  }
}

async function closePool() {
  await pool.end();
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  closePool,
  pool,
  query,
  runSqlFile,
  testConnection,
  withTransaction
};
