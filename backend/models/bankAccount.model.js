const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'bank_accounts',
  idPrefix: 'bank',
  columns: [
    column({ key: 'bankName', db: 'bank_name' }),
    column({ key: 'accountHolderName', db: 'account_holder_name' }),
    column({ key: 'accountNumber', db: 'account_number' }),
    column({ key: 'ifsc', db: 'ifsc' }),
    column({ key: 'branch', db: 'branch' }),
    column({ key: 'accountType', db: 'account_type' }),
    column({ key: 'upiId', db: 'upi_id' }),
    column({ key: 'openingBalance', db: 'opening_balance', type: 'number' }),
    column({ key: 'isPrimary', db: 'is_primary', type: 'boolean' })
  ],
  searchColumns: ['bank_name', 'account_holder_name', 'account_number']
});
