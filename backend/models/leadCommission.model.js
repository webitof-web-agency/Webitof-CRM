const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'lead_commissions',
  idPrefix: 'commission',
  columns: [
    column({ key: 'commissionDate', db: 'commission_date', type: 'date' }),
    column({ key: 'partnerId', db: 'partner_id' }),
    column({ key: 'partnerName', db: 'partner_name' }),
    column({ key: 'clientId', db: 'client_id' }),
    column({ key: 'projectId', db: 'project_id' }),
    column({ key: 'commissionType', db: 'commission_type' }),
    column({ key: 'commissionPercentage', db: 'commission_percentage', type: 'number' }),
    column({ key: 'commissionBaseAmount', db: 'commission_base_amount', type: 'number' }),
    column({ key: 'commissionAmount', db: 'commission_amount', type: 'number' }),
    column({ key: 'gstRegistered', db: 'gst_registered', type: 'boolean' }),
    column({ key: 'gstRate', db: 'gst_rate', type: 'number' }),
    column({ key: 'gstAmount', db: 'gst_amount', type: 'number' }),
    column({ key: 'grossPayable', db: 'gross_payable', type: 'number' }),
    column({ key: 'tdsApplicable', db: 'tds_applicable', type: 'boolean' }),
    column({ key: 'tdsSection', db: 'tds_section' }),
    column({ key: 'tdsRate', db: 'tds_rate', type: 'number' }),
    column({ key: 'tdsAmount', db: 'tds_amount', type: 'number' }),
    column({ key: 'netPayable', db: 'net_payable', type: 'number' }),
    column({ key: 'paymentStatus', db: 'payment_status' }),
    column({ key: 'invoiceNumber', db: 'invoice_number' }),
    column({ key: 'invoiceUrl', db: 'invoice_url' }),
    column({ key: 'tdsDepositStatus', db: 'tds_deposit_status' }),
    column({ key: 'notes', db: 'notes' })
  ],
  searchColumns: ['partner_name', 'payment_status', 'invoice_number']
});
