const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool, query, closePool } = require('../config/db');

async function migrate() {
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address text;`);
    console.log('Added phone and address to users table successfully.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await closePool();
  }
}

migrate();
