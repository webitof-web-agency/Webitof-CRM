const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'expenses',
  idPrefix: 'expense',
  columns: [
    column({ key: 'expenseDate', db: 'expense_date', type: 'date' }),
    column({ key: 'vendor', db: 'vendor' }),
    column({ key: 'vendorId', db: 'vendor_id' }),
    column({ key: 'categoryId', db: 'category_id' }),
    column({ key: 'clientId', db: 'client_id' }),
    column({ key: 'projectId', db: 'project_id' }),
    column({ key: 'amountBeforeGst', db: 'amount_before_gst', type: 'number' }),
    column({ key: 'gstRate', db: 'gst_rate', type: 'number' }),
    column({ key: 'gstAmount', db: 'gst_amount', type: 'number' }),
    column({ key: 'totalAmount', db: 'total_amount', type: 'number' }),
    column({ key: 'invoiceNumber', db: 'invoice_number' }),
    column({ key: 'vendorGstin', db: 'vendor_gstin' }),
    column({ key: 'paymentMode', db: 'payment_mode' }),
    column({ key: 'bankAccountId', db: 'bank_account_id' }),
    column({ key: 'itcEligible', db: 'itc_eligible', type: 'boolean' }),
    column({ key: 'rcmApplicable', db: 'rcm_applicable', type: 'boolean' }),
    column({ key: 'attachmentUrl', db: 'attachment_url' }),
    column({ key: 'notes', db: 'notes' })
  ],
  searchColumns: ['vendor', 'invoice_number', 'vendor_gstin']
});
