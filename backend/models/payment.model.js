const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'payments',
  idPrefix: 'payment',
  columns: [
    column({ key: 'paymentDate', db: 'payment_date', type: 'date' }),
    column({ key: 'clientId', db: 'client_id' }),
    column({ key: 'projectId', db: 'project_id' }),
    column({ key: 'invoiceId', db: 'invoice_id' }),
    column({ key: 'amountReceived', db: 'amount_received', type: 'number' }),
    column({ key: 'tdsDeducted', db: 'tds_deducted', type: 'number' }),
    column({ key: 'paymentMode', db: 'payment_mode' }),
    column({ key: 'bankAccountId', db: 'bank_account_id' }),
    column({ key: 'transactionId', db: 'transaction_id' }),
    column({ key: 'notes', db: 'notes' })
  ],
  searchColumns: ['transaction_id', 'payment_mode']
});
