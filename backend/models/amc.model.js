const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'amcs',
  idPrefix: 'amc',
  columns: [
    column({ key: 'clientId', db: 'client_id' }),
    column({ key: 'projectId', db: 'project_id' }),
    column({ key: 'title', db: 'title' }),
    column({ key: 'amcType', db: 'amc_type' }),
    column({ key: 'startDate', db: 'start_date', type: 'date' }),
    column({ key: 'endDate', db: 'end_date', type: 'date' }),
    column({ key: 'billingCycle', db: 'billing_cycle' }),
    column({ key: 'amcAmount', db: 'amc_amount', type: 'number' }),
    column({ key: 'gstType', db: 'gst_type' }),
    column({ key: 'nextInvoiceDate', db: 'next_invoice_date', type: 'date' }),
    column({ key: 'reminderDays', db: 'reminder_days', type: 'number' }),
    column({ key: 'status', db: 'status' }),
    column({ key: 'autoInvoice', db: 'auto_invoice', type: 'boolean' }),
    column({ key: 'remarks', db: 'remarks' })
  ],
  searchColumns: ['title', 'amc_type', 'billing_cycle', 'status']
});
