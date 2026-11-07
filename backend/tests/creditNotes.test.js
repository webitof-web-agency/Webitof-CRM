// Credit note API: validation, the cap, numbering, locking, cancelling. A stateful fake database stands in for Postgres.
const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../config/db');
const invoiceModel = require('../models/invoice.model');
const clientModel = require('../models/client.model');
const creditNoteModel = require('../models/creditNote.model');
const settingsModel = require('../models/settings.model');
const notifications = require('../services/notification.service');

// rows as Postgres would return them (snake_case); hydrateRow turns them into model objects
let noteRows = [];
let log = [];
let invoices = {};
const db = {
  async query(sql, params = []) {
    const text = sql.replace(/\s+/g, ' ').trim();
    log.push(text);
    if (/select credit_note_number from credit_notes/.test(text)) return { rows: noteRows.map((r) => ({ credit_note_number: r.credit_note_number })) };
    if (/from credit_notes where invoice_id = \$1 and status = 'Issued'/.test(text)) {
      return { rows: noteRows.filter((r) => r.invoice_id === params[0] && r.status === 'Issued') };
    }
    if (/from payments where invoice_id/.test(text)) return { rows: [] };
    return { rows: [], rowCount: 0 };
  }
};
config.withTransaction = async (work) => work(db);

invoiceModel.findById = async (id) => invoices[id] || null;
invoiceModel.update = async (id, patch) => {
  invoices[id] = { ...invoices[id], ...patch };
  return invoices[id];
};
clientModel.findById = async () => ({ id: 'c1', state: 'Delhi', country: 'India' });
settingsModel.getSettings = async () => ({ company: { state: 'Delhi', country: 'India' }, gst: { defaultRate: 18 } });
notifications.notifyBusinessEvent = async () => {};

const toRow = (n) => ({
  id: n.id,
  credit_note_number: n.creditNoteNumber,
  invoice_id: n.invoiceId,
  status: n.status,
  total_amount: n.totalAmount,
  taxable_amount: n.taxableAmount,
  gst_amount: n.gstAmount,
  issue_date: n.issueDate
});
let created = [];
creditNoteModel.create = async (body) => {
  const record = { id: 'cn_' + (created.length + 1), ...body };
  created.push(record);
  noteRows.push(toRow(record));
  return record;
};
creditNoteModel.findByExactId = async (id) => {
  const row = noteRows.find((r) => r.id === id);
  return row ? creditNoteModel.hydrateRow(row) : null;
};
creditNoteModel.update = async (id, patch) => {
  const row = noteRows.find((r) => r.id === id);
  Object.assign(row, { status: patch.status ?? row.status });
  return { ...creditNoteModel.hydrateRow(row), ...patch };
};

const controller = require('../controllers/creditNotes.controller');

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
    handler({ user: { id: 'u1' }, params: {}, body: {}, query: {}, ...req }, res, (error) => resolve({ status: error?.statusCode || 500, error }));
  });
}
const invoice = (extra = {}) => ({
  id: 'inv1',
  invoiceNumber: 'INV-001',
  clientId: 'c1',
  status: 'Sent',
  amountType: 'GST Extra',
  invoiceDate: '2026-10-05',
  dueDate: '2099-01-01',
  items: [{ description: 'Work', quantity: 1, rate: 1000 }],
  ...extra
});
const issue = (body) => call(controller.create, { body: { invoiceId: 'inv1', reason: 'Billing error', issueDate: '2026-10-20', ...body } });

test.beforeEach(() => {
  noteRows = [];
  created = [];
  log = [];
  invoices = { inv1: invoice() };
});

test('crediting a whole invoice issues CN-001, updates the invoice and takes the locks first', async () => {
  const { status, body } = await issue({});
  assert.equal(status, 201);
  assert.equal(created[0].creditNoteNumber, 'CN-001');
  assert.equal(created[0].totalAmount, 1180);
  assert.equal(created[0].reason, 'Billing error');
  assert.equal(body.data.invoice.status, 'Credited', 'the invoice is re-worked after the credit');
  assert.equal(body.data.invoice.balanceDue, 0);
  assert.equal(invoices.inv1.status, 'Credited');
  const numberLock = log.findIndex((q) => /pg_advisory_xact_lock\(hashtext\('webitof-credit-note-number'\)\)/.test(q));
  const rowLock = log.findIndex((q) => /select id from invoices where id = \$1 for update/.test(q));
  assert.ok(numberLock >= 0 && rowLock >= 0 && Math.max(numberLock, rowLock) < log.length, 'both locks were taken');
});

test('numbers continue from the highest existing one', async () => {
  noteRows = [{ id: 'x', credit_note_number: 'CN-007', invoice_id: 'other', status: 'Issued', total_amount: 1 }];
  await issue({ items: [{ description: 'Revision', quantity: 1, rate: 100 }] });
  assert.equal(created[0].creditNoteNumber, 'CN-008');
});

test('a partial credit is taxed like invoice lines and leaves the rest owed', async () => {
  const { status, body } = await issue({ items: [{ description: 'Revision', quantity: 1, rate: 500 }] });
  assert.equal(status, 201);
  assert.deepEqual([created[0].taxableAmount, created[0].gstAmount, created[0].totalAmount], [500, 90, 590]);
  assert.equal(body.data.invoice.balanceDue, 590);
  assert.equal(body.data.invoice.status, 'Sent');
});

test('credit notes together cannot exceed the invoice value', async () => {
  assert.equal((await issue({ items: [{ description: 'First', quantity: 1, rate: 800 }] })).status, 201); // 944
  const second = await issue({ items: [{ description: 'Second', quantity: 1, rate: 300 }] }); // 354 > 236 left
  assert.equal(second.status, 409);
  assert.match(second.error.message, /cannot exceed the invoice value of/);
  assert.equal((await issue({ items: [{ description: 'Rest', quantity: 1, rate: 200 }] })).status, 201, 'exactly the remainder is allowed');
  assert.equal(created.length, 2);
});

test('only issued invoices can be credited, and not before they were dated', async () => {
  invoices.inv1 = invoice({ status: 'Draft' });
  assert.equal((await issue({})).status, 409);
  invoices.inv1 = invoice({ status: 'Cancelled' });
  assert.equal((await issue({})).status, 409);
  invoices.inv1 = invoice();
  assert.equal((await issue({ issueDate: '2026-10-01' })).status, 400);
  assert.equal((await issue({ invoiceId: 'nope' })).status, 404);
  assert.equal(created.length, 0);
});

test('a reason, a valid date and sensible lines are required', async () => {
  assert.equal((await issue({ reason: '  ' })).status, 400);
  assert.equal((await issue({ reason: 'x'.repeat(501) })).status, 400);
  assert.equal((await issue({ issueDate: '2026-02-30' })).status, 400);
  assert.equal((await call(controller.create, { body: { reason: 'r' } })).status, 400, 'no invoice chosen');
  for (const line of [
    { description: '', quantity: 1, rate: 10 },
    { description: 'x', quantity: 0, rate: 10 },
    { description: 'x', quantity: 1, rate: -5 },
    { description: 'x', quantity: 1, rate: 10, gstRate: 150 }
  ]) {
    assert.equal((await issue({ items: [line] })).status, 400, JSON.stringify(line));
  }
  assert.equal(created.length, 0);
});

test('cancelling a credit note restores the balance, needs a reason and works once', async () => {
  await issue({});
  assert.equal(invoices.inv1.status, 'Credited');
  const id = created[0].id;
  assert.equal((await call(controller.cancel, { params: { id }, body: {} })).status, 400, 'a reason is required');
  const { status, body } = await call(controller.cancel, { params: { id }, body: { reason: 'Raised by mistake' } });
  assert.equal(status, 200);
  assert.equal(body.data.creditNote.status, 'Cancelled');
  assert.equal(body.data.invoice.balanceDue, 1180);
  assert.equal(invoices.inv1.status, 'Sent', 'the invoice reopens');
  assert.equal((await call(controller.cancel, { params: { id }, body: { reason: 'again' } })).status, 409);
  assert.equal((await call(controller.cancel, { params: { id: 'missing' }, body: { reason: 'x' } })).status, 404);
});

test('after a cancelled credit the invoice can be credited again', async () => {
  await issue({});
  await call(controller.cancel, { params: { id: created[0].id }, body: { reason: 'oops' } });
  assert.equal((await issue({})).status, 201);
  assert.equal(created.length, 2);
  assert.equal(created[1].creditNoteNumber, 'CN-002', 'numbers are never reused, even for a cancelled note');
});
