const { closePool } = require('../config/db');
const { ensureLeadManagementSchema } = require('../config/initDb');

async function run() {
  try {
    console.log('Applying additive lead management upgrade...');
    await ensureLeadManagementSchema();
    console.log('Lead management upgrade applied successfully.');
  } catch (error) {
    console.error('Lead management upgrade failed:', error.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

run();
