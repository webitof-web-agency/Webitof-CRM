const { pool, closePool } = require('../config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Applying client compliance & address fields migration...');
    await client.query(`
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS tax_treatment text;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS tds_applicable boolean NOT NULL DEFAULT false;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS tds_section text;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS pincode text;
    `);
    console.log('✅ Migration applied successfully.');
  } finally {
    client.release();
    await closePool();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
