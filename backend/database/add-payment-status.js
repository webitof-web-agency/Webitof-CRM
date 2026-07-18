const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query, closePool } = require('../config/db');

async function migrate() {
  try {
    await query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_status text;`);
    await query(`ALTER TABLE payments ALTER COLUMN payment_status SET DEFAULT 'Received';`);
    await query(`
      UPDATE payments
      SET payment_status = COALESCE(NULLIF(payment_status, ''), 'Received')
      WHERE payment_status IS NULL OR payment_status = '';
    `);
    await query(`ALTER TABLE payments ALTER COLUMN payment_status SET NOT NULL;`);
    console.log('Added payment_status column to payments table successfully.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await closePool();
  }
}

migrate();
