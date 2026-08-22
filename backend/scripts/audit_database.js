const { pool, closePool } = require('../config/db');
const fs = require('fs');
const path = require('path');

// Models to table name mappings
const modelMapping = {
  'amc.model.js': 'amcs',
  'amcAutomationLog.model.js': 'amc_automation_logs',
  'bankAccount.model.js': 'bank_accounts',
  'bankTransaction.model.js': 'bank_transactions',
  'client.model.js': 'clients',
  'clientContact.model.js': 'client_contacts',
  'expense.model.js': 'expenses',
  'fileAsset.model.js': 'file_assets',
  'followUp.model.js': 'follow_ups',
  'invoice.model.js': 'invoices',
  'lead.model.js': 'leads',
  'leadCommission.model.js': 'lead_commissions',
  'leadContact.model.js': 'lead_contacts',
  'leadEvent.model.js': 'lead_events',
  'leadPipeline.model.js': 'lead_pipelines',
  'masterItem.model.js': 'master_items',
  'notification.model.js': 'notifications',
  'outsourcingExpense.model.js': 'outsourcing_expenses',
  'payment.model.js': 'payments',
  'permission.model.js': 'permissions',
  'project.model.js': 'projects',
  'renewal.model.js': 'renewals',
  'role.model.js': 'roles',
  'settings.model.js': 'settings',
  'storageFolder.model.js': 'storage_folders',
  'user.model.js': 'users',
  'workflowAutomationLog.model.js': 'workflow_automation_logs'
};

async function audit() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'");
    const dbColumns = {};
    for (const row of res.rows) {
      if (!dbColumns[row.table_name]) dbColumns[row.table_name] = new Set();
      dbColumns[row.table_name].add(row.column_name);
    }

    const modelsDir = path.join(__dirname, '..', 'models');
    console.log('=== AUDITING ALL MODELS AGAINST POSTGRESQL DATABASE ===\n');
    let hasMissing = false;

    for (const [file, tableName] of Object.entries(modelMapping)) {
      const model = require(path.join(modelsDir, file));
      const existingInDb = dbColumns[tableName];
      if (!existingInDb) {
        console.log(`❌ Table missing in DB: "${tableName}" (from ${file})`);
        hasMissing = true;
        continue;
      }

      const modelCols = model.columns || [];
      const missingCols = [];
      for (const col of modelCols) {
        if (!existingInDb.has(col.db)) {
          missingCols.push(col.db);
        }
      }

      if (missingCols.length > 0) {
        hasMissing = true;
        console.log(`❌ Table "${tableName}" (${file}) is MISSING columns in PostgreSQL:`, missingCols);
      } else {
        console.log(`✅ Table "${tableName}" (${file}) - all ${modelCols.length} columns exist in DB.`);
      }
    }

    if (!hasMissing) {
      console.log('\n🎉 ALL MODELS PERFECTLY ALIGNED WITH DATABASE!');
    }
  } finally {
    client.release();
    await closePool();
  }
}

audit().catch(err => {
  console.error('Audit Error:', err);
  process.exit(1);
});
