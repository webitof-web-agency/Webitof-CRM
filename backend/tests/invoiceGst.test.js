const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateInvoiceTotals } = require('../utils/finance');

const settings = { company: { state: 'Delhi', country: 'India', gstin: '07AAAAA0000A1Z5' }, gst: { defaultRate: 18 } };
const local = { state: 'Delhi', country: 'India' };
const item = (extra = {}) => ({ description: 'Work', quantity: 1, rate: 1000, ...extra });

test('GST is still charged after a discount when the item relies on the default rate', () => {
  const result = calculateInvoiceTotals({ amountType: 'GST Extra', discountType: 'percent', discountValue: 10 }, [item()], settings, local);
  assert.equal(result.taxableAmount, 900);
  assert.equal(result.gstAmount, 162);
  assert.equal(result.totalAmount, 1062);
});

test('the same holds for a flat discount and for an explicit item rate', () => {
  const flat = calculateInvoiceTotals({ amountType: 'GST Extra', discountType: 'flat', discountValue: 100 }, [item()], settings, local);
  assert.equal(flat.gstAmount, 162);
  assert.equal(flat.totalAmount, 1062);
  const explicit = calculateInvoiceTotals({ amountType: 'GST Extra', discountType: 'percent', discountValue: 50 }, [item({ gstRate: 12 })], settings, local);
  assert.equal(explicit.taxableAmount, 500);
  assert.equal(explicit.gstAmount, 60);
});

test('a discounted invoice taxes each line at its own rate', () => {
  const result = calculateInvoiceTotals(
    { amountType: 'GST Extra', discountType: 'percent', discountValue: 10 },
    [item({ rate: 1000, gstRate: 5 }), item({ rate: 1000 })],
    settings,
    local
  );
  // 900 at 5% + 900 at the default 18%
  assert.equal(result.gstAmount, 45 + 162);
});

test('No Tax stays tax-free with or without a discount', () => {
  const plain = calculateInvoiceTotals({ amountType: 'No Tax' }, [item()], settings, local);
  const discounted = calculateInvoiceTotals({ amountType: 'No Tax', discountType: 'percent', discountValue: 10 }, [item()], settings, local);
  assert.equal(plain.gstAmount, 0);
  assert.equal(discounted.gstAmount, 0);
  assert.equal(discounted.totalAmount, 900);
});

test('an export "with payment of IGST" is not turned into zero-rated by the LUT default', () => {
  const overseas = { country: 'United States', state: 'California' };
  const withPayment = calculateInvoiceTotals({ amountType: 'GST Extra', invoiceType: 'Export with payment of IGST' }, [item()], settings, overseas);
  assert.equal(withPayment.igst, 180);
  assert.equal(withPayment.gstAmount, 180);
  const withoutPayment = calculateInvoiceTotals({ amountType: 'GST Extra', invoiceType: 'Export without payment of IGST' }, [item()], settings, overseas);
  assert.equal(withoutPayment.gstAmount, 0);
  const lutDefault = calculateInvoiceTotals({ amountType: 'GST Extra', invoiceType: 'Export' }, [item()], settings, overseas);
  assert.equal(lutDefault.gstAmount, 0, 'with no explicit choice the LUT setting still applies');
});
