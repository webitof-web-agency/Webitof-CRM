const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFinanceSummary, buildFinanceLedger, isIssuedInvoice } = require('../services/finance.service');

const line = { description: 'Work', quantity: 1, rate: 1000, gstRate: 0 };
const invoice = (id, status) => ({
  id,
  status,
  invoiceNumber: 'INV-' + id,
  invoiceDate: '2026-10-05',
  dueDate: '2099-01-01',
  clientId: 'c1',
  amountType: 'No Tax',
  items: [line]
});
const baseState = (overrides = {}) => ({
  settings: {},
  clients: [{ id: 'c1', companyName: 'Acme' }],
  projects: [],
  vendors: [],
  invoices: [],
  payments: [],
  expenses: [],
  outsourcingExpenses: [],
  leadCommissions: [],
  bankAccounts: [],
  bankTransactions: [],
  ...overrides
});

test('draft and cancelled invoices are not issued; sent and paid ones are', () => {
  assert.equal(isIssuedInvoice({ status: 'Draft' }), false);
  assert.equal(isIssuedInvoice({ status: 'Cancelled' }), false);
  for (const status of ['Sent', 'Paid', 'Partially Paid', 'Overdue']) assert.equal(isIssuedInvoice({ status }), true, status);
});

test('a draft invoice does not inflate invoiced and receivable totals', () => {
  const summary = buildFinanceSummary(baseState({ invoices: [invoice('1', 'Sent'), invoice('2', 'Draft'), invoice('3', 'Cancelled')] }));
  assert.equal(summary.totalInvoiceAmount, 1000);
  assert.equal(summary.totalReceivables, 1000);
});

test('rejected, cancelled and draft expenses stay out of the totals', () => {
  const expense = (id, extra) => ({ id, expenseDate: '2026-10-06', expenseType: 'Office', amountBeforeGst: 500, totalAmount: 500, ...extra });
  const summary = buildFinanceSummary(
    baseState({
      expenses: [
        expense('a', { status: 'Approved', approvalStatus: 'Approved' }),
        expense('b', { approvalStatus: 'Rejected' }),
        expense('c', { status: 'Cancelled' }),
        expense('d', { status: 'Draft' })
      ]
    })
  );
  assert.equal(summary.totalExpenses, 500);
});

test('only Credit and Debit bank rows move cash; Transfer and Adjustment do not', () => {
  const bank = (id, transactionType, amount) => ({ id, transactionType, amount, date: '2026-10-07', bankAccountId: 'b1' });
  const summary = buildFinanceSummary(
    baseState({
      bankAccounts: [{ id: 'b1', openingBalance: 1000 }],
      bankTransactions: [bank('1', 'Credit', 100), bank('2', 'Transfer', 999), bank('3', 'Adjustment', 50), bank('4', 'Debit', 30)]
    })
  );
  assert.equal(summary.bankCredits, 100);
  assert.equal(summary.bankDebits, 30);
  assert.equal(summary.cashInBank, 1070);
});

test('ledger totals count cash once: payments and unlinked bank credits, not invoices or mirrored bank rows', () => {
  const state = baseState({
    invoices: [invoice('1', 'Sent')],
    payments: [{ id: 'p1', invoiceId: '1', clientId: 'c1', amountReceived: 1000, tdsDeducted: 0, paymentDate: '2026-10-08', paymentStatus: 'Received' }],
    bankTransactions: [
      { id: 't1', transactionType: 'Credit', amount: 1000, date: '2026-10-08', linkedInvoiceId: '1' }, // mirrors the payment
      { id: 't2', transactionType: 'Credit', amount: 200, date: '2026-10-09' }, // genuine unlinked receipt
      { id: 't3', transactionType: 'Transfer', amount: 5000, date: '2026-10-09' } // own-account move
    ]
  });
  const { totals, entries } = buildFinanceLedger(state, {});
  assert.equal(totals.totalIn, 1200);
  assert.equal(totals.totalOut, 0);
  assert.equal(totals.net, 1200);
  assert.ok(entries.some((e) => e.module === 'invoices'), 'invoices still appear in the ledger list');
  assert.ok(entries.find((e) => e.id === 't3').neutral, 'transfers are flagged neutral');
});

test('TDS settles the invoice but is not cash: cash flow and the ledger show only what reached the bank', () => {
  const state = baseState({
    invoices: [invoice('1', 'Sent')],
    payments: [{ id: 'p1', invoiceId: '1', clientId: 'c1', amountReceived: 900, tdsDeducted: 100, paymentDate: '2026-10-08', paymentStatus: 'Received' }]
  });
  const summary = buildFinanceSummary(state);
  assert.equal(summary.totalReceived, 1000, 'applied to the invoice: cash plus TDS');
  assert.equal(summary.totalCashReceived, 900);
  assert.equal(summary.totalTdsDeducted, 100);
  assert.equal(summary.totalOutstanding, 0, 'the invoice is fully settled');
  assert.equal(summary.netCashFlow, 900, 'cash flow does not count the TDS withheld');
  const { totals, entries } = buildFinanceLedger(state, {});
  const receipt = entries.find((entry) => entry.module === 'payments');
  assert.equal(receipt.amount, 900);
  assert.equal(receipt.tdsDeducted, 100);
  assert.equal(receipt.appliedAmount, 1000);
  assert.equal(totals.totalIn, 900);
});

test('a bounced payment contributes neither cash nor TDS', () => {
  const state = baseState({
    invoices: [invoice('1', 'Sent')],
    payments: [{ id: 'p1', invoiceId: '1', clientId: 'c1', amountReceived: 900, tdsDeducted: 100, paymentDate: '2026-10-08', paymentStatus: 'Bounced' }]
  });
  const summary = buildFinanceSummary(state);
  assert.equal(summary.totalCashReceived, 0);
  assert.equal(summary.totalTdsDeducted, 0);
  assert.equal(summary.totalOutstanding, 1000);
});
