const { query, closePool } = require('../config/db');

async function keepalive() {
  try {
    await query('SELECT 1');
    console.log(`${new Date().toISOString()} Supabase keepalive OK`);
    process.exitCode = 0;
  } catch (err) {
    // Avoid logging sensitive information in err if any
    console.error(`${new Date().toISOString()} Supabase keepalive FAILED:`, err.message || err);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

keepalive();
