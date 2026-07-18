const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query, closePool } = require('../config/db');

async function migrate() {
  try {
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_type text;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payee_type text;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payee_id text;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payee_name text;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS employee_id text REFERENCES users(id) ON DELETE SET NULL;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status text;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approval_status text;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_status text;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period_start date;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period_end date;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS due_date date;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_amount numeric(14,2) NOT NULL DEFAULT 0;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS balance_due numeric(14,2) NOT NULL DEFAULT 0;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS cost_center text;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tds_applicable boolean NOT NULL DEFAULT false;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tds_section text;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tds_rate numeric(8,2) NOT NULL DEFAULT 0;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tds_amount numeric(14,2) NOT NULL DEFAULT 0;`);
    await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;`);
    await query(`ALTER TABLE expenses ALTER COLUMN expense_type SET DEFAULT 'Vendor Bill';`);
    await query(`ALTER TABLE expenses ALTER COLUMN payee_type SET DEFAULT 'Vendor';`);
    await query(`ALTER TABLE expenses ALTER COLUMN status SET DEFAULT 'Draft';`);
    await query(`ALTER TABLE expenses ALTER COLUMN approval_status SET DEFAULT 'Pending';`);
    await query(`ALTER TABLE expenses ALTER COLUMN payment_status SET DEFAULT 'Unpaid';`);
    await query(`
      UPDATE expenses
      SET
        expense_type = COALESCE(NULLIF(expense_type, ''), 'Vendor Bill'),
        payee_type = COALESCE(NULLIF(payee_type, ''), CASE WHEN employee_id IS NOT NULL THEN 'Employee' ELSE 'Vendor' END),
        payee_id = COALESCE(NULLIF(payee_id, ''), vendor_id::text),
        payee_name = COALESCE(NULLIF(payee_name, ''), vendor, ''),
        vendor = COALESCE(NULLIF(vendor, ''), payee_name, ''),
        status = COALESCE(NULLIF(status, ''), 'Draft'),
        approval_status = COALESCE(NULLIF(approval_status, ''), 'Pending'),
        payment_status = COALESCE(NULLIF(payment_status, ''), 'Unpaid'),
        paid_amount = COALESCE(paid_amount, 0),
        balance_due = COALESCE(balance_due, GREATEST(0, COALESCE(total_amount, 0) - COALESCE(paid_amount, 0))),
        tds_applicable = COALESCE(tds_applicable, false),
        tds_rate = COALESCE(tds_rate, 0),
        tds_amount = COALESCE(tds_amount, 0)
      WHERE TRUE;
    `);
    await query(`ALTER TABLE expenses ALTER COLUMN expense_type SET NOT NULL;`);
    await query(`ALTER TABLE expenses ALTER COLUMN payee_type SET NOT NULL;`);
    await query(`ALTER TABLE expenses ALTER COLUMN status SET NOT NULL;`);
    await query(`ALTER TABLE expenses ALTER COLUMN approval_status SET NOT NULL;`);
    await query(`ALTER TABLE expenses ALTER COLUMN payment_status SET NOT NULL;`);
    console.log('Added advanced expense columns successfully.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await closePool();
  }
}

migrate();
