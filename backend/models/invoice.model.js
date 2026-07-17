const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'invoices',
  idPrefix: 'invoice',
  columns: [
    column({ key: 'invoiceNumber', db: 'invoice_number' }),
    column({ key: 'invoiceDate', db: 'invoice_date', type: 'date' }),
    column({ key: 'dueDate', db: 'due_date', type: 'date' }),
    column({ key: 'clientId', db: 'client_id' }),
    column({ key: 'projectId', db: 'project_id' }),
    column({ key: 'placeOfSupply', db: 'place_of_supply' }),
    column({ key: 'invoiceType', db: 'invoice_type' }),
    column({ key: 'amountType', db: 'amount_type' }),
    column({ key: 'status', db: 'status' }),
    column({ key: 'notes', db: 'notes' }),
    column({ key: 'isRecurring', db: 'is_recurring', type: 'boolean' }),
    column({ key: 'recurringInterval', db: 'recurring_interval' }),
    column({ key: 'sourceRenewalId', db: 'source_renewal_id' }),
    column({ key: 'sourceAmcId', db: 'source_amc_id' }),
    column({ key: 'taxableAmount', db: 'taxable_amount', type: 'number' }),
    column({ key: 'cgst', db: 'cgst', type: 'number' }),
    column({ key: 'sgst', db: 'sgst', type: 'number' }),
    column({ key: 'utgst', db: 'utgst', type: 'number' }),
    column({ key: 'igst', db: 'igst', type: 'number' }),
    column({ key: 'gstAmount', db: 'gst_amount', type: 'number' }),
    column({ key: 'totalAmount', db: 'total_amount', type: 'number' }),
    column({ key: 'items', db: 'items', type: 'json' })
  ],
  searchColumns: ['invoice_number', 'status', 'invoice_type', 'place_of_supply']
});
