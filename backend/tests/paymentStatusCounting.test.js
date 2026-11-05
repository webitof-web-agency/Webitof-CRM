const test = require('node:test');
const assert = require('node:assert/strict');
const { getPaymentAppliedAmount, getInvoiceSnapshot } = require('../services/finance.service');

const invoice = {
  id: 'inv_1',
  status: 'Sent',
  invoiceDate: '2026-01-01',
  dueDate: '2099-01-01',
  items: [{ description: 'Work', quantity: 1, rate: 1000 }]
};

test('only Received/Cleared (or unset) payments count as money received', () => {
  const base = { amountReceived: 500, tdsDeducted: 50 };
  assert.equal(getPaymentAppliedAmount({ ...base, paymentStatus: 'Received' }), 550);
  assert.equal(getPaymentAppliedAmount({ ...base, paymentStatus: 'Cleared' }), 550);
  assert.equal(getPaymentAppliedAmount({ ...base }), 550);
  for (const status of ['Pending Clearance', 'Bounced', 'Refunded', 'Reversed']) {
    assert.equal(getPaymentAppliedAmount({ ...base, paymentStatus: status }), 0, status);
  }
});

test('a bounced cheque does not mark the invoice paid', () => {
  const snap = getInvoiceSnapshot(invoice, [{ amountReceived: 99999, paymentStatus: 'Bounced' }], {}, {});
  assert.equal(snap.amountPaid, 0);
  assert.notEqual(snap.status, 'Paid');
  assert.ok(snap.balanceDue > 0);
});
