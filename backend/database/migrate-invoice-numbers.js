const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const { query, withTransaction, closePool } = require('../config/db');
const { getSettings } = require('../models/settings.model');
const { generateInvoiceNumber } = require('../utils/invoice');
const { normalizeInvoiceNumber } = require('../utils/invoice');

async function migrateInvoiceNumbers() {
  const settings = (await getSettings()) || {};
  const prefix = settings?.invoice?.prefix || 'INV';
  const normalizeSettings = {
    ...settings,
    invoice: {
      ...(settings.invoice || {}),
      prefix,
      numberFormat: 'plain'
    }
  };

  const { rows } = await query(`
    SELECT id, invoice_number, invoice_date, created_at
    FROM invoices
    ORDER BY invoice_date ASC, created_at ASC, id ASC
  `);

  if (!rows.length) {
    console.log('No invoices found. Nothing to migrate.');
    return;
  }

  const updates = rows.map((row, index) => {
    return {
      id: row.id,
      currentInvoiceNumber: row.invoice_number,
      desiredInvoiceNumber: generateInvoiceNumber(normalizeSettings, index + 1, row.invoice_date)
    };
  });

  const changed = updates.filter((row) => String(row.currentInvoiceNumber || '') !== String(row.desiredInvoiceNumber || ''));
  if (!changed.length) {
    console.log('Invoice numbers are already aligned. No migration needed.');
    return;
  }

  await withTransaction(async (client) => {
    for (const row of changed) {
      await client.query(
        'UPDATE invoices SET invoice_number = $1, updated_at = NOW() WHERE id = $2',
        [`__invoice_migration__${row.id}`, row.id]
      );
    }

    for (const row of changed) {
      await client.query(
        'UPDATE invoices SET invoice_number = $1, updated_at = NOW() WHERE id = $2',
        [row.desiredInvoiceNumber, row.id]
      );
    }
  });

  console.log(`Migrated ${changed.length} invoice number(s).`);
}

async function main() {
  try {
    await migrateInvoiceNumbers();
  } catch (error) {
    console.error('Invoice migration failed:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main();
