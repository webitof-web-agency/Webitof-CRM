const { query, closePool } = require('../config/db');

async function run() {
  try {
    console.log('Starting leads table migration...');
    
    // Add columns to leads table
    const alterQueries = [
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_name text;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS type text DEFAULT 'Organization';`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS website text;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_date date;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS managers text;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS address text;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS city text;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS state text;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS pincode text;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS country text DEFAULT 'India';`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS vat_number text;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS gst_number text;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS currency text;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS currency_symbol text;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_name text;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to text REFERENCES users(id) ON DELETE SET NULL;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_by text REFERENCES users(id) ON DELETE SET NULL;`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS labels jsonb DEFAULT '[]'::jsonb;`
    ];

    for (let q of alterQueries) {
      await query(q);
      console.log(`Executed: ${q}`);
    }

    await query(`
      update leads l
      set owner_name = coalesce(l.owner_name, u.full_name)
      from users u
      where l.assigned_to = u.id
        and (l.owner_name is null or l.owner_name = '')
    `);
    console.log('Backfilled owner names from assigned users where available.');

    console.log('Migration completed successfully.');
  } catch(e) {
    console.error('Migration failed:', e);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

run();
