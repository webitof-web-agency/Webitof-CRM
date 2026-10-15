const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveTaxTreatment,
  calculateQuotationTotals
} = require('../utils/taxCalculationEngine');

test('intra-state supply (Chhattisgarh to Chhattisgarh) resolves to CGST + SGST', () => {
  const treatment = resolveTaxTreatment({
    supplierState: 'Chhattisgarh',
    clientState: 'Chhattisgarh',
    gstApplicable: true,
    gstRate: 18
  });

  assert.equal(treatment.taxType, 'CGST_SGST');
  assert.equal(treatment.isInterState, false);
  assert.equal(treatment.cgstRate, 9);
  assert.equal(treatment.sgstRate, 9);
  assert.equal(treatment.igstRate, 0);
});

test('inter-state supply (Chhattisgarh supplier to West Bengal client) resolves to IGST', () => {
  const treatment = resolveTaxTreatment({
    supplierState: 'Chhattisgarh',
    clientState: 'West Bengal',
    gstApplicable: true,
    gstRate: 18
  });

  assert.equal(treatment.taxType, 'IGST');
  assert.equal(treatment.isInterState, true);
  assert.equal(treatment.igstRate, 18);
  assert.equal(treatment.cgstRate, 0);
  assert.equal(treatment.sgstRate, 0);
  assert.match(treatment.label, /IGST \(18%\)/);
});

test('inter-state supply resolves via Client GSTIN 2-digit code', () => {
  const treatment = resolveTaxTreatment({
    supplierState: 'Chhattisgarh',
    clientGstin: '19AABCB1234D1Z5',
    gstApplicable: true,
    gstRate: 18
  });

  assert.equal(treatment.taxType, 'IGST');
  assert.equal(treatment.isInterState, true);
});

test('export outside India resolves to Zero-Rated under LUT', () => {
  const treatment = resolveTaxTreatment({
    supplierState: 'Chhattisgarh',
    clientCountry: 'United States',
    gstApplicable: true,
    gstRate: 18
  });

  assert.equal(treatment.taxType, 'EXPORT_ZERO_RATED');
  assert.equal(treatment.gstRate, 0);
});

test('commercial totals calculate accurate discount, taxable amount, and IGST', () => {
  const totals = calculateQuotationTotals({
    amount: 100000,
    discountEnabled: true,
    discountType: 'percent',
    discountValue: 10,
    gstApplicable: true,
    gstRate: 18,
    supplierState: 'Chhattisgarh',
    clientState: 'West Bengal'
  });

  assert.equal(totals.subtotal, 100000);
  assert.equal(totals.discountAmount, 10000);
  assert.equal(totals.taxableAmount, 90000);
  assert.equal(totals.taxType, 'IGST');
  assert.equal(totals.isInterState, true);
  assert.equal(totals.igstAmount, 16200);
  assert.equal(totals.cgstAmount, 0);
  assert.equal(totals.sgstAmount, 0);
  assert.equal(totals.gstAmount, 16200);
  assert.equal(totals.totalAmount, 106200);
});

test('commercial totals calculate accurate intra-state CGST + SGST split', () => {
  const totals = calculateQuotationTotals({
    amount: 50000,
    discountEnabled: false,
    gstApplicable: true,
    gstRate: 18,
    supplierState: 'Chhattisgarh',
    clientState: 'Chhattisgarh'
  });

  assert.equal(totals.taxableAmount, 50000);
  assert.equal(totals.taxType, 'CGST_SGST');
  assert.equal(totals.isInterState, false);
  assert.equal(totals.cgstAmount, 4500);
  assert.equal(totals.sgstAmount, 4500);
  assert.equal(totals.igstAmount, 0);
  assert.equal(totals.gstAmount, 9000);
  assert.equal(totals.totalAmount, 59000);
});
