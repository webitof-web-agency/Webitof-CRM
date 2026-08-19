const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateInvoiceTotals } = require('../utils/finance');

const settings = {
  company: { state: 'Chhattisgarh', country: 'India', gstin: '22AAAAA0000A1Z5' },
  gst: { gstRegistered: true, autoDetectTax: true, defaultRate: 18, lutEnabled: false }
};

const client = {
  state: 'Chhattisgarh',
  country: 'India',
  gstin: '22BBBBB0000B1Z5'
};

test('invoice totals apply line discount percentage, global discount and advance', () => {
  const totals = calculateInvoiceTotals({
    amountType: 'GST Extra',
    invoiceType: 'Regular',
    discountType: 'percent',
    discountValue: 10,
    advanceAmount: 100
  }, [{
    quantity: 2,
    rate: 1000,
    discount: 5,
    gstRate: 18
  }], settings, client);

  assert.equal(totals.taxableAmount, 1710);
  assert.equal(totals.discountAmount, 190);
  assert.equal(totals.cgst, 153.9);
  assert.equal(totals.sgst, 153.9);
  assert.equal(totals.gstAmount, 307.8);
  assert.equal(totals.totalAmount, 1917.8);
  assert.equal(totals.taxType, 'cgst_sgst');
});

test('hidden invoice line items do not affect totals', () => {
  const totals = calculateInvoiceTotals({
    amountType: 'No Tax'
  }, [{
    quantity: 1,
    rate: 1000,
    discount: 0,
    hidden: true
  }, {
    quantity: 1,
    rate: 500,
    discount: 0
  }], settings, client);

  assert.equal(totals.taxableAmount, 500);
  assert.equal(totals.totalAmount, 500);
});
