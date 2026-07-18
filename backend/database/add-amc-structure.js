const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query, closePool } = require('../config/db');

async function migrate() {
  try {
    await query(`ALTER TABLE amcs ADD COLUMN IF NOT EXISTS title text;`);
    await query(`ALTER TABLE amcs ALTER COLUMN title SET DEFAULT '';`);
    await query(`
      UPDATE amcs
      SET title = COALESCE(NULLIF(title, ''), NULLIF(amc_type, ''), 'AMC')
      WHERE title IS NULL OR title = '';
    `);
    await query(`ALTER TABLE amcs ALTER COLUMN title SET NOT NULL;`);
    console.log('Added AMC title column successfully.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await closePool();
  }
}

migrate();
