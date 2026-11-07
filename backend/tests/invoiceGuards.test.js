// Deleting and editing issued invoices. Models are stubbed, so no database is needed.
const test = require('node:test');
const assert = require('node:assert/strict');

const invoiceModel = require('../models/invoice.model');
const paymentModel = require('../models/payment.model');
const clientModel = require('../models/client.model');
const settingsModel = require('../models/settings.model');

let stored = {};
let payments = [];
const removed = [];
const updated = [];
invoiceModel.findById = async (id) => stored[id] || null;
invoiceModel.remove = async (id) => {
  removed.push(id);
  return true;
};
invoiceModel.update = async (id, body) => {
  updated.push([id, body]);
  return { id, ...body };
};
paymentModel.list = async () => payments;
clientModel.findById = async () => ({ id: 'c1', state: 'Delhi' });
settingsModel.getSettings = async () => ({ gst: {}, invoice: {}, company: {} });

const controller = require('../controllers/invoices.controller');

function call(handler, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body });
      }
    };
    handler({ user: { id: 'u1', permissions: ['invoices.write', 'invoices.delete'] }, params: {}, body: {}, ...req }, res, (error) =>
      resolve({ status: error?.statusCode || 500, error })
    );
  });
}
const invoice = (status, extra = {}) => ({ id: 'inv1', invoiceNumber: 'INV-001', clientId: 'c1', status, items: [], ...extra });

test.beforeEach(() => {
  stored = {};
  payments = [];
  removed.length = 0;
  updated.length = 0;
});

test('only a draft without payments can be deleted', async () => {
  stored.inv1 = invoice('Sent');
  assert.equal((await call(controller.remove, { params: { id: 'inv1' } })).status, 409);
  stored.inv1 = invoice('Paid');
  assert.equal((await call(controller.remove, { params: { id: 'inv1' } })).status, 409);
  stored.inv1 = invoice('Draft');
  payments = [{ id: 'p1', invoiceId: 'inv1', amountReceived: 10 }];
  assert.equal((await call(controller.remove, { params: { id: 'inv1' } })).status, 409);
  assert.deepEqual(removed, [], 'nothing was deleted in the refused cases');
  payments = [];
  assert.equal((await call(controller.remove, { params: { id: 'inv1' } })).status, 200);
  assert.deepEqual(removed, ['inv1']);
  assert.equal((await call(controller.remove, { params: { id: 'missing' } })).status, 404);
});

test('paid and cancelled invoices cannot be edited', async () => {
  for (const status of ['Paid', 'Cancelled']) {
    stored.inv1 = invoice(status);
    const result = await call(controller.update, { params: { id: 'inv1' }, body: { notes: 'x' } });
    assert.equal(result.status, 409, status);
  }
  assert.deepEqual(updated, []);
});

test('an invoice with payments received cannot be cancelled, but one with only a bounced payment can', async () => {
  stored.inv1 = invoice('Partially Paid');
  payments = [{ id: 'p1', invoiceId: 'inv1', amountReceived: 400, paymentStatus: 'Received' }];
  assert.equal((await call(controller.update, { params: { id: 'inv1' }, body: { status: 'Cancelled' } })).status, 409);
  payments = [{ id: 'p2', invoiceId: 'inv1', amountReceived: 400, paymentStatus: 'Bounced' }];
  const result = await call(controller.update, { params: { id: 'inv1' }, body: { status: 'Cancelled' } });
  assert.notEqual(result.status, 409, 'the guard lets it through');
});
