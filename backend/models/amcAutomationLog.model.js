const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'amc_automation_logs',
  idPrefix: 'amclog',
  columns: [
    column({ key: 'amcId', db: 'amc_id' }),
    column({ key: 'runId', db: 'run_id' }),
    column({ key: 'runSource', db: 'run_source' }),
    column({ key: 'action', db: 'action' }),
    column({ key: 'status', db: 'status' }),
    column({ key: 'dueDate', db: 'due_date', type: 'date' }),
    column({ key: 'invoiceId', db: 'invoice_id' }),
    column({ key: 'invoiceNumber', db: 'invoice_number' }),
    column({ key: 'message', db: 'message' }),
    column({ key: 'payload', db: 'payload', type: 'json' })
  ],
  searchColumns: ['action', 'status', 'invoice_number', 'message', 'run_source']
});
