const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'credit_notes',
  idPrefix: 'cn',
  columns: [
    column({ key: 'creditNoteNumber', db: 'credit_note_number' }),
    column({ key: 'invoiceId', db: 'invoice_id' }),
    column({ key: 'clientId', db: 'client_id' }),
    column({ key: 'issueDate', db: 'issue_date', type: 'date' }),
    column({ key: 'reason', db: 'reason' }),
    column({ key: 'status', db: 'status' }),
    column({ key: 'amountType', db: 'amount_type' }),
    column({ key: 'placeOfSupply', db: 'place_of_supply' }),
    column({ key: 'items', db: 'items', type: 'json' }),
    column({ key: 'taxableAmount', db: 'taxable_amount', type: 'number' }),
    column({ key: 'cgst', db: 'cgst', type: 'number' }),
    column({ key: 'sgst', db: 'sgst', type: 'number' }),
    column({ key: 'utgst', db: 'utgst', type: 'number' }),
    column({ key: 'igst', db: 'igst', type: 'number' }),
    column({ key: 'gstAmount', db: 'gst_amount', type: 'number' }),
    column({ key: 'totalAmount', db: 'total_amount', type: 'number' }),
    column({ key: 'cancelledAt', db: 'cancelled_at' }),
    column({ key: 'cancelReason', db: 'cancel_reason' }),
    column({ key: 'createdBy', db: 'created_by' })
  ],
  searchColumns: ['credit_note_number', 'reason', 'status']
});
