require('dotenv').config({ path: '../.env' });
const { query } = require('../config/db');

async function run() {
  try {
    await query(`UPDATE users SET phone = '+91 98765 43210' WHERE username = 'support'`);
    await query(`UPDATE users SET phone = '+91 91234 56789' WHERE username = 'manager'`);
    await query(`UPDATE users SET phone = '+91 99887 76655' WHERE username = 'sales'`);
    console.log('Successfully updated phone numbers!');
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
