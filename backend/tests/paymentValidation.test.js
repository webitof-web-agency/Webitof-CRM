// Payment entry rules. Runs without a database: the invoice/client/settings models are stubbed and the
// transaction client is a scripted fake.
const test = require('node:test');
const assert = require('node:assert/strict');

const invoiceModel = require('../models/invoice.model');
const clientModel = require('../models/client.model');
const settingsModel = require('../models/settings.model');

let invoices = {};
invoiceModel.findById = async (id) => invoices[id] || null;
clientModel.findById = async () => ({ id: 'c1', state: 'Delhi' });
settingsModel.getSettings = async () => ({ gst: {}, invoice: {} });

const { normalizePayment } = require('../controllers/payments.controller');

const invoice = (extra = {}) => ({
  id: 'inv1',
  clientId: 'c1',
  status: 'Sent',
  amountType: 'No Tax',
  invoiceDate: '2026-10-01',
  dueDate: '2099-01-01',
  items: [{ description: 'Work', quantity: 1, rate: 1000, gstRate: 0 }],
  ...extra
});

function fakeDb({ existingPayments = [], duplicateOf = null } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push(sql.replace(/\s+/g, ' ').trim());
      if (/for update/.test(sql)) return { rows: [{ id: params[0] }] };
      if (/from payments where invoice_id/.test(sql)) return { rows: existingPayments };
      if (/from payments where lower\(transaction_id\)/.test(sql))
        return { rows: duplicateOf && params[1] !== duplicateOf ? [{ id: duplicateOf }] : [] };
      return { rows: [] };
    }
  };
}
const paid = (id, amount, extra = {}) => ({ id, invoice_id: 'inv1', amount_received: amount, tds_deducted: 0, payment_status: 'Received', ...extra });
const status = async (promise) => {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    return error.statusCode;
  }
};
const base = { invoiceId: 'inv1', clientId: 'c1', amountReceived: 500, paymentMode: 'UPI' };

test.beforeEach(() => {
  invoices = { inv1: invoice() };
});

test('an amount must be a positive number', async () => {
  for (const amountReceived of [0, -5, '', 'abc', undefined]) {
    assert.equal(await status(normalizePayment({ ...base, amountReceived }, null, fakeDb())), 400, String(amountReceived));
  }
  assert.equal(await status(normalizePayment({ ...base, tdsDeducted: -1 }, null, fakeDb())), 400);
});

test('payments are refused on cancelled, draft or missing invoices, and when the client does not match', async () => {
  invoices.inv1 = invoice({ status: 'Cancelled' });
  assert.equal(await status(normalizePayment(base, null, fakeDb())), 409);
  invoices.inv1 = invoice({ status: 'Draft' });
  assert.equal(await status(normalizePayment(base, null, fakeDb())), 409);
  invoices = {};
  assert.equal(await status(normalizePayment(base, null, fakeDb())), 404);
  invoices.inv1 = invoice();
  assert.equal(await status(normalizePayment({ ...base, clientId: 'someone-else' }, null, fakeDb())), 400);
});

test('a payment cannot exceed the invoice balance, TDS included', async () => {
  assert.equal(await status(normalizePayment({ ...base, amountReceived: 1500 }, null, fakeDb())), 409);
  assert.equal(await status(normalizePayment({ ...base, amountReceived: 1000 }, null, fakeDb())), 'ok');
  assert.equal(await status(normalizePayment({ ...base, amountReceived: 900, tdsDeducted: 100 }, null, fakeDb())), 'ok');
  assert.equal(await status(normalizePayment({ ...base, amountReceived: 950, tdsDeducted: 100 }, null, fakeDb())), 409);
});

test('earlier payments reduce the balance, and editing a payment does not count it against itself', async () => {
  const db = () => fakeDb({ existingPayments: [paid('p1', 700)] });
  assert.equal(await status(normalizePayment({ ...base, amountReceived: 400 }, null, db())), 409);
  assert.equal(await status(normalizePayment({ ...base, amountReceived: 300 }, null, db())), 'ok');
  const current = { id: 'p1', invoiceId: 'inv1', clientId: 'c1', amountReceived: 700, tdsDeducted: 0, paymentStatus: 'Received' };
  assert.equal(await status(normalizePayment({ amountReceived: 1000 }, current, db())), 'ok', 'raising its own amount up to the balance');
  assert.equal(await status(normalizePayment({ amountReceived: 1200 }, current, db())), 409);
});

test('payments that do not count as received (bounced, pending clearance) are not limited by the balance', async () => {
  for (const paymentStatus of ['Bounced', 'Pending Clearance', 'Reversed']) {
    assert.equal(await status(normalizePayment({ ...base, amountReceived: 5000, paymentStatus }, null, fakeDb())), 'ok', paymentStatus);
  }
});

test('an already over-recorded payment can still have its note edited', async () => {
  const current = { id: 'p1', invoiceId: 'inv1', clientId: 'c1', amountReceived: 1500, tdsDeducted: 0, paymentStatus: 'Received', notes: 'old' };
  const db = fakeDb({ existingPayments: [paid('p1', 1500)] });
  const result = await normalizePayment({ notes: 'fixed typo' }, current, db);
  assert.equal(result.notes, 'fixed typo');
});

test('the same transaction reference cannot be recorded twice, but a payment may keep its own', async () => {
  assert.equal(await status(normalizePayment({ ...base, transactionId: 'UTR123' }, null, fakeDb({ duplicateOf: 'p9' }))), 409);
  assert.equal(await status(normalizePayment({ ...base, transactionId: 'UTR123' }, null, fakeDb())), 'ok');
  const current = { id: 'p9', invoiceId: 'inv1', clientId: 'c1', amountReceived: 500, tdsDeducted: 0, paymentStatus: 'Received', transactionId: 'UTR123' };
  assert.equal(await status(normalizePayment({ notes: 'x' }, current, fakeDb({ duplicateOf: 'p9' }))), 'ok');
});

test('the invoice row is locked first so simultaneous payments serialize', async () => {
  const db = fakeDb();
  await normalizePayment(base, null, db);
  assert.match(db.calls[0], /select id from invoices where id = \$1 for update/);
});

test('fields can be cleared on edit, and the default date is the Indian business date', async () => {
  const current = { id: 'p1', invoiceId: 'inv1', clientId: 'c1', amountReceived: 500, tdsDeducted: 0, paymentStatus: 'Received', notes: 'remember', bankAccountId: 'b1' };
  const cleared = await normalizePayment({ invoiceId: '', notes: '', bankAccountId: '' }, current, fakeDb());
  assert.equal(cleared.invoiceId, null);
  assert.equal(cleared.notes, '');
  assert.equal(cleared.bankAccountId, null);
  const created = await normalizePayment({ amountReceived: 10, clientId: 'c1' }, null, fakeDb());
  assert.match(created.paymentDate, /^\d{4}-\d{2}-\d{2}$/);
});
