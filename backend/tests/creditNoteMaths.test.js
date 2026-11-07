// Credit notes in the money maths: balances, status, totals, the cap, and the P&L / GST reports.
const test = require('node:test');
const assert = require('node:assert/strict');

const analytics = require('../services/analytics.service');
let businessState = null;
analytics.loadBusinessState = async () => businessState;

const finance = require('../services/finance.service');
const reports = require('../controllers/reports.controller');

const settings = { company: { state: 'Delhi', country: 'India', gstin: '07AAAAA0000A1Z5' }, gst: { defaultRate: 18 } };
const client = { id: 'c1', state: 'Delhi', country: 'India' };
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
const note = (extra = {}) => ({ id: 'cn1', invoiceId: 'inv1', status: 'Issued', issueDate: '2026-10-10', taxableAmount: 400, cgst: 36, sgst: 36, utgst: 0, igst: 0, gstAmount: 72, totalAmount: 472, ...extra });
const payment = (amount, extra = {}) => ({ id: 'p' + amount, invoiceId: 'inv1', amountReceived: amount, tdsDeducted: 0, paymentStatus: 'Received', ...extra });
const snap = (notes = [], payments = [], inv = invoice()) => finance.getInvoiceSnapshot(inv, payments, settings, client, notes);

test('a credit note reduces the balance on an unpaid invoice', () => {
  const s = snap([note()]);
  assert.equal(s.totalAmount, 1180);
  assert.equal(s.creditTotal, 472);
  assert.equal(s.balanceDue, 708);
  assert.equal(s.refundDue, 0);
  assert.equal(s.status, 'Sent');
});

test('an invoice credited in full with nothing received becomes Credited', () => {
  const s = snap([note({ taxableAmount: 1000, gstAmount: 180, totalAmount: 1180 })]);
  assert.equal(s.balanceDue, 0);
  assert.equal(s.status, 'Credited');
  assert.equal(s.refundDue, 0);
});

test('payments plus a credit note that settle the invoice make it Paid; a paid invoice that is then credited is owed a refund', () => {
  assert.equal(snap([note({ totalAmount: 472 })], [payment(708)]).status, 'Paid');
  const overpaid = snap([note({ totalAmount: 472 })], [payment(1180)]);
  assert.equal(overpaid.balanceDue, 0);
  assert.equal(overpaid.refundDue, 472, 'paid in full, then credited: the client is owed that back');
  assert.equal(overpaid.status, 'Paid');
});

test('a cancelled credit note no longer counts, and removing every credit reopens a Credited invoice', () => {
  assert.equal(snap([note({ status: 'Cancelled' })]).balanceDue, 1180);
  const reopened = snap([note({ status: 'Cancelled', totalAmount: 1180 })], [], invoice({ status: 'Credited' }));
  assert.equal(reopened.status, 'Sent');
});

test('a full credit note equals the invoice (taxable plus GST) and the cap is that value', () => {
  const inv = invoice();
  const full = finance.calculateCreditNoteTotals(inv, settings, client, null);
  assert.deepEqual([full.taxableAmount, full.gstAmount, full.totalAmount], [1000, 180, 1180]);
  assert.deepEqual([full.cgst, full.sgst], [90, 90]);
  assert.equal(finance.getInvoiceCreditCapacity(inv, settings, client), 1180);
});

test('a partial credit note is taxed like invoice lines, with the invoice\'s own GST treatment', () => {
  const partial = finance.calculateCreditNoteTotals(invoice(), settings, client, [{ description: 'Revision', quantity: 1, rate: 500 }]);
  assert.deepEqual([partial.taxableAmount, partial.gstAmount, partial.totalAmount], [500, 90, 590]);
  assert.deepEqual([partial.cgst, partial.sgst, partial.igst], [45, 45, 0]);
  const interstate = finance.calculateCreditNoteTotals(invoice(), settings, { ...client, state: 'Karnataka' }, [{ description: 'Revision', quantity: 1, rate: 500, gstRate: 12 }]);
  assert.deepEqual([interstate.igst, interstate.cgst, interstate.totalAmount], [60, 0, 560]);
  const noTax = finance.calculateCreditNoteTotals(invoice({ amountType: 'No Tax' }), settings, client, [{ description: 'Refund', quantity: 2, rate: 100 }]);
  assert.deepEqual([noTax.gstAmount, noTax.totalAmount], [0, 200]);
});

test('the finance summary counts credit notes against receivables', () => {
  const state = { settings, clients: [client], invoices: [invoice()], payments: [], expenses: [], outsourcingExpenses: [], leadCommissions: [], bankAccounts: [], bankTransactions: [], creditNotes: [note(), note({ id: 'cn2', status: 'Cancelled' })] };
  const summary = finance.buildFinanceSummary(state);
  assert.equal(summary.totalOutstanding, 708);
  assert.equal(summary.totalCreditNotes, 472, 'only issued credit notes');
});

function run(handler, query = {}) {
  return new Promise((resolve, reject) => {
    const res = { json: (body) => resolve(body.data) };
    handler({ query }, res, reject);
  });
}
const reportState = () => ({
  settings,
  clients: [client],
  invoices: [invoice()],
  payments: [],
  expenses: [],
  outsourcingExpenses: [],
  leadCommissions: [],
  vendors: [],
  users: [],
  creditNotes: [note({ issueDate: '2026-10-10' }), note({ id: 'cn-old', issueDate: '2026-02-01', taxableAmount: 100, cgst: 9, sgst: 9, gstAmount: 18, totalAmount: 118 })]
});

test('P&L revenue and GST output are net of credit notes', async () => {
  businessState = reportState();
  const pl = await run(reports.profitLoss);
  assert.equal(pl.revenue, 1000 - 400 - 100);
  assert.equal(pl.grossRevenue, 1180 - 472 - 118);
  assert.equal(pl.creditNotes, 590);
  const gst = await run(reports.gstSummary);
  assert.equal(gst.outputGst, 180 - 72 - 18);
  assert.equal(gst.cgst, 90 - 36 - 9);
  assert.equal(gst.sgst, 90 - 36 - 9);
  assert.equal(gst.creditNoteGst, 90);
});

test('a credit note adjusts the period it is issued in, not the invoice\'s period', async () => {
  businessState = reportState();
  // October 2026 holds the invoice and one credit note; the February 2026 credit note is out of range.
  const october = await run(reports.gstSummary, { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(october.outputGst, 180 - 72);
  // A later month with no invoice but a credit note: output GST goes negative (a reversal), as it does when filing.
  businessState = reportState();
  businessState.creditNotes = [note({ issueDate: '2026-11-20' })];
  const november = await run(reports.gstSummary, { from: '2026-11-01', to: '2026-11-30' });
  assert.equal(november.outputGst, -72);
  const pl = await run(reports.profitLoss, { from: '2026-11-01', to: '2026-11-30' });
  assert.equal(pl.revenue, -400);
});
