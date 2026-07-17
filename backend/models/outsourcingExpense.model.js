const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'outsourcing_expenses',
  idPrefix: 'outsource',
  columns: [
    column({ key: 'expenseDate', db: 'expense_date', type: 'date' }),
    column({ key: 'clientId', db: 'client_id' }),
    column({ key: 'projectId', db: 'project_id' }),
    column({ key: 'vendorId', db: 'vendor_id' }),
    column({ key: 'vendorName', db: 'vendor_name' }),
    column({ key: 'workType', db: 'work_type' }),
    column({ key: 'description', db: 'description' }),
    column({ key: 'baseAmount', db: 'base_amount', type: 'number' }),
    column({ key: 'vendorGstRegistered', db: 'vendor_gst_registered', type: 'boolean' }),
    column({ key: 'gstApplicable', db: 'gst_applicable', type: 'boolean' }),
    column({ key: 'gstRate', db: 'gst_rate', type: 'number' }),
    column({ key: 'gstAmount', db: 'gst_amount', type: 'number' }),
    column({ key: 'totalAmount', db: 'total_amount', type: 'number' }),
    column({ key: 'itcEligible', db: 'itc_eligible', type: 'boolean' }),
    column({ key: 'paymentStatus', db: 'payment_status' }),
    column({ key: 'vendorInvoiceNumber', db: 'vendor_invoice_number' }),
    column({ key: 'vendorInvoiceUrl', db: 'vendor_invoice_url' }),
    column({ key: 'paymentProofUrl', db: 'payment_proof_url' }),
    column({ key: 'notes', db: 'notes' })
  ],
  searchColumns: ['vendor_name', 'work_type', 'payment_status']
});
