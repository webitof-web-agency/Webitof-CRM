// The unauthenticated invoice link. Runs without a database: models are stubbed before the controller loads.
const test = require('node:test');
const assert = require('node:assert/strict');

const invoiceModel = require('../models/invoice.model');
const clientModel = require('../models/client.model');
const paymentModel = require('../models/payment.model');
const bankAccountModel = require('../models/bankAccount.model');
const settingsModel = require('../models/settings.model');

const invoice = {
  id: 'inv_9f2c1d0e8a7b4c5d9e3f6a1b2c4d5e6f',
  invoiceNumber: 'INV-001',
  clientId: 'c1',
  status: 'Paid',
  amountType: 'No Tax',
  invoiceDate: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10),
  dueDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
  sourceQuotationId: 'evt_secret',
  payload: { internal: 'do not show' },
  items: [{ description: 'Work', quantity: 1, rate: 1000, gstRate: 0, serviceSnapshot: { defaultPrice: 400 }, quotedRate: 400 }]
};

const calls = { findById: 0, exact: [] };
invoiceModel.findById = async () => {
  calls.findById += 1;
  return invoice; // a fallback lookup would happily resolve by number or prefix
};
invoiceModel.findByExactId = async (id) => {
  calls.exact.push(id);
  return id === invoice.id ? invoice : null;
};
clientModel.findById = async () => ({ id: 'c1', companyName: 'Acme', phone: '999', email: 'a@acme.test', notes: 'private' });
bankAccountModel.findById = async () => null;
paymentModel.list = async () => [{ invoiceId: invoice.id, amountReceived: 1000, tdsDeducted: 0, paymentStatus: 'Received' }];
require('../models/creditNote.model').list = async () => [];
let settingsStub = { company: { name: 'Webitof' }, invoice: {}, gst: {}, tds: {} };
settingsModel.getSettings = async () => settingsStub;

const { getPublic } = require('../controllers/invoices.controller');

function run(id) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      headers: {},
      set(values) {
        Object.assign(this.headers, values);
        return this;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body, headers: this.headers });
      }
    };
    getPublic({ params: { id } }, res, reject);
  });
}

test('an invoice number cannot open the public link, so invoices cannot be enumerated', async () => {
  for (const guess of ['INV-001', 'inv-001', 'inv_9f2c', 'inv']) {
    const { status } = await run(guess);
    assert.equal(status, 404, guess);
  }
  assert.equal(calls.findById, 0, 'the fallback lookup (number / id prefix) is never used');
});

test('the exact id opens it, and a paid invoice is shown as paid, not overdue', async () => {
  const { status, body } = await run(invoice.id);
  assert.equal(status, 200);
  assert.equal(body.data.invoice.status, 'Paid');
  assert.equal(body.data.invoice.amountPaid, 1000);
  assert.equal(body.data.invoice.balanceDue, 0);
});

test('internal fields and client contact details do not leave through the link', async () => {
  const { body } = await run(invoice.id);
  const shown = body.data.invoice;
  assert.equal('payload' in shown, false);
  assert.equal('sourceQuotationId' in shown, false);
  assert.equal('serviceSnapshot' in shown.items[0], false);
  assert.equal('quotedRate' in shown.items[0], false);
  assert.equal(shown.items[0].description, 'Work');
  assert.equal('phone' in body.data.client, false);
  assert.equal('notes' in body.data.client, false);
});

test('the public page is never cached or indexed', async () => {
  const { headers } = await run(invoice.id);
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.match(headers['X-Robots-Tag'], /noindex/);
});

test('a draft invoice has no public page', async () => {
  const original = invoice.status;
  invoice.status = 'Draft';
  try {
    assert.equal((await run(invoice.id)).status, 404);
  } finally {
    invoice.status = original;
  }
});

test('the link expires 180 days after the invoice / due date, unless settings say otherwise', async () => {
  const saved = { invoiceDate: invoice.invoiceDate, dueDate: invoice.dueDate };
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  try {
    invoice.invoiceDate = daysAgo(400);
    invoice.dueDate = daysAgo(370);
    const expired = await run(invoice.id);
    assert.equal(expired.status, 410);
    assert.match(expired.body.message, /expired/i);

    // a later due date keeps it alive: expiry counts from the later of the two
    invoice.dueDate = daysAgo(100);
    assert.equal((await run(invoice.id)).status, 200);

    // configurable, and 0 means never
    invoice.invoiceDate = daysAgo(400);
    invoice.dueDate = daysAgo(370);
    const original = settingsStub;
    settingsStub = { ...original, invoice: { publicLinkExpiryDays: 0 } };
    assert.equal((await run(invoice.id)).status, 200);
    settingsStub = { ...original, invoice: { publicLinkExpiryDays: 30 } };
    invoice.invoiceDate = daysAgo(60);
    invoice.dueDate = daysAgo(45);
    assert.equal((await run(invoice.id)).status, 410);
    settingsStub = original;
  } finally {
    Object.assign(invoice, saved);
  }
});
