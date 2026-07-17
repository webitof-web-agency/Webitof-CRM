const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'bank_transactions',
  idPrefix: 'txn',
  columns: [
    column({ key: 'date', db: 'date', type: 'date' }),
    column({ key: 'bankAccountId', db: 'bank_account_id' }),
    column({ key: 'transactionType', db: 'transaction_type' }),
    column({ key: 'amount', db: 'amount', type: 'number' }),
    column({ key: 'linkedClientId', db: 'linked_client_id' }),
    column({ key: 'linkedProjectId', db: 'linked_project_id' }),
    column({ key: 'linkedInvoiceId', db: 'linked_invoice_id' }),
    column({ key: 'linkedExpenseId', db: 'linked_expense_id' }),
    column({ key: 'notes', db: 'notes' })
  ],
  searchColumns: ['transaction_type', 'notes']
});
