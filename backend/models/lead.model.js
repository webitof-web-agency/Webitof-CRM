const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'leads',
  idPrefix: 'lead',
  columns: [
    column({ key: 'name', db: 'name' }),
    column({ key: 'companyName', db: 'company_name' }),
    column({ key: 'type', db: 'type' }),
    column({ key: 'email', db: 'email' }),
    column({ key: 'phone', db: 'phone' }),
    column({ key: 'website', db: 'website' }),
    column({ key: 'pipelineId', db: 'pipeline_id' }),
    column({ key: 'status', db: 'status' }),
    column({ key: 'source', db: 'source' }),
    column({ key: 'value', db: 'value', type: 'number' }),
    column({ key: 'followUpDate', db: 'follow_up_date', type: 'date' }),
    column({ key: 'address', db: 'address' }),
    column({ key: 'city', db: 'city' }),
    column({ key: 'state', db: 'state' }),
    column({ key: 'pincode', db: 'pincode' }),
    column({ key: 'country', db: 'country' }),
    column({ key: 'vatNumber', db: 'vat_number' }),
    column({ key: 'gstNumber', db: 'gst_number' }),
    column({ key: 'currency', db: 'currency' }),
    column({ key: 'currencySymbol', db: 'currency_symbol' }),
    column({ key: 'labels', db: 'labels', type: 'json' }),
    column({ key: 'managers', db: 'managers' }),
    column({ key: 'ownerName', db: 'owner_name' }),
    column({ key: 'assignedTo', db: 'assigned_to' }),
    column({ key: 'createdBy', db: 'created_by' }),
    column({ key: 'notes', db: 'notes' })
  ],
  searchColumns: ['name', 'company_name', 'email', 'phone', 'city', 'state', 'country']
});
