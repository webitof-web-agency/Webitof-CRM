const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'renewals',
  idPrefix: 'renewal',
  columns: [
    column({ key: 'clientId', db: 'client_id' }),
    column({ key: 'projectId', db: 'project_id' }),
    column({ key: 'category', db: 'category' }),
    column({ key: 'domainName', db: 'domain_name' }),
    column({ key: 'hostingName', db: 'hosting_name' }),
    column({ key: 'packageName', db: 'package_name' }),
    column({ key: 'softwareName', db: 'software_name' }),
    column({ key: 'licenseScope', db: 'license_scope' }),
    column({ key: 'seats', db: 'seats', type: 'number' }),
    column({ key: 'licenseKey', db: 'license_key' }),
    column({ key: 'provider', db: 'provider' }),
    column({ key: 'purchaseDate', db: 'purchase_date', type: 'date' }),
    column({ key: 'durationYears', db: 'duration_years', type: 'number' }),
    column({ key: 'renewalDate', db: 'renewal_date', type: 'date' }),
    column({ key: 'expiryDate', db: 'expiry_date', type: 'date' }),
    column({ key: 'purchasePrice', db: 'purchase_price', type: 'number' }),
    column({ key: 'renewalPrice', db: 'renewal_price', type: 'number' }),
    column({ key: 'renewalCost', db: 'renewal_cost', type: 'number' }),
    column({ key: 'clientCharge', db: 'client_charge', type: 'number' }),
    column({ key: 'reminderDate', db: 'reminder_date', type: 'date' }),
    column({ key: 'autoRenewal', db: 'auto_renewal', type: 'boolean' }),
    column({ key: 'financeAction', db: 'finance_action' }),
    column({ key: 'financeEntryId', db: 'finance_entry_id' }),
    column({ key: 'financeEntryType', db: 'finance_entry_type' }),
    column({ key: 'sourceInvoiceId', db: 'source_invoice_id' }),
    column({ key: 'sourceExpenseId', db: 'source_expense_id' }),
    column({ key: 'status', db: 'status' }),
    column({ key: 'remarks', db: 'remarks' })
  ],
  searchColumns: ['category', 'domain_name', 'hosting_name', 'software_name', 'provider', 'status']
});
