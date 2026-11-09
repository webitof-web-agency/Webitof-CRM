// The builder's preview must equal what saving would compute. Models are stubbed, so no database is needed.
const test = require('node:test');
const assert = require('node:assert/strict');

const clientModel = require('../models/client.model');
const settingsModel = require('../models/settings.model');
const masterItemModel = require('../models/masterItem.model');
const { calculateInvoiceTotals } = require('../utils/finance');

let client = { id: 'c1', state: 'Chhattisgarh', country: 'India' };
const settings = { gst: { gstRegistered: true, autoDetectTax: true, lutEnabled: true, defaultRate: 18 }, company: { state: 'Chhattisgarh', country: 'India' }, invoice: {} };
clientModel.findById = async () => client;
settingsModel.getSettings = async () => settings;
masterItemModel.listByType = async () => [];

const controller = require('../controllers/invoices.controller');

function call(body) {
  return new Promise((resolve) => {
    const res = { status() { return this; }, json: (payload) => resolve(payload) };
    controller.previewTotals({ user: { id: 'u1' }, body }, res, (error) => resolve({ error }));
  });
}

const items = [{ description: 'Work', quantity: 1, rate: 0.05, gstRate: 18 }, { description: 'More', quantity: 3, rate: 333.33, gstRate: 12 }];

test('preview totals are exactly the totals saving would compute', async () => {
  const body = { clientId: 'c1', amountType: 'GST Extra', discountType: 'percent', discountValue: 7, items };
  const preview = await call(body);
  const saved = calculateInvoiceTotals(body, items, settings, client);
  assert.equal(preview.success, true);
  for (const key of ['taxableAmount', 'cgst', 'sgst', 'igst', 'gstAmount', 'totalAmount', 'discountAmount']) {
    assert.equal(preview.data[key], saved[key], key);
  }
});

test('CGST and SGST always add up to the GST, even when it splits into an odd paisa', async () => {
  const preview = await call({ clientId: 'c1', amountType: 'GST Extra', items: [{ description: 'x', quantity: 1, rate: 0.05, gstRate: 18 }] });
  assert.equal(Math.round((preview.data.cgst + preview.data.sgst) * 100), Math.round(preview.data.gstAmount * 100));
});

test('an out-of-state client is previewed as IGST, and an overseas one as untaxed export', async () => {
  client = { id: 'c1', state: 'Maharashtra', country: 'India' };
  const interState = await call({ clientId: 'c1', amountType: 'GST Extra', items });
  assert.equal(interState.data.taxType, 'igst');
  assert.equal(interState.data.cgst, 0);
  assert.ok(interState.data.igst > 0);

  client = { id: 'c1', state: '', country: 'United States' };
  const exported = await call({ clientId: 'c1', amountType: 'GST Extra', invoiceType: 'Export without payment of IGST', items });
  assert.equal(exported.data.gstAmount, 0);
});

test('GST-inclusive pricing is previewed with the tax carved out of the price', async () => {
  client = { id: 'c1', state: 'Chhattisgarh', country: 'India' };
  const preview = await call({ clientId: 'c1', amountType: 'GST Inclusive', items: [{ description: 'x', quantity: 1, rate: 118, gstRate: 18 }] });
  assert.equal(preview.data.totalAmount, 118);
  assert.equal(preview.data.taxableAmount, 100);
  assert.equal(preview.data.gstAmount, 18);
});
