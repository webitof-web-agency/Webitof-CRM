const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool, query, closePool } = require('../config/db');

async function migrate() {
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_file_id text;`);
    console.log('Added avatar columns to users table successfully.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await closePool();
  }
}

migrate();
