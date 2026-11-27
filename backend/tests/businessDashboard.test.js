// Business dashboard money block: month figures, aging buckets, top dues and the 12-month trend.
const test = require('node:test');
const assert = require('node:assert/strict');
const { _private } = require('../services/businessDashboard.service');
const { businessDate } = require('../utils/format');

// Invoice ages are measured against the real business date, so the fixture is built around it.
const today = businessDate();
const shift = (days) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const twoMonthsBack = _private.monthBounds(today, 2);
const thisMonth = _private.monthBounds(today);

const settings = { company: { state: 'Delhi', country: 'India', gstin: '07AAAAA0000A1Z5' }, gst: { defaultRate: 18 } };
const clients = [
  { id: 'c1', name: 'Alpha', state: 'Delhi', country: 'India' },
  { id: 'c2', name: 'Beta', state: 'Delhi', country: 'India' }
];
const invoice = (id, clientId, invoiceDate, dueDate, rate, extra = {}) => ({
  id,
  invoiceNumber: id,
  clientId,
  status: 'Sent',
  amountType: 'GST Extra',
  invoiceDate,
  dueDate,
  items: [{ description: 'Work', quantity: 1, rate }],
  ...extra
});
const state = {
  settings,
  clients,
  projects: [],
  invoices: [
    invoice('i1', 'c1', today, shift(30), 1000), // 1180, not due yet
    invoice('i2', 'c2', shift(-100), shift(-48), 2000), // 2360, 48 days late (billed 3+ months back)
    invoice('i3', 'c1', twoMonthsBack.from, twoMonthsBack.to, 500), // 590, paid in full
    invoice('i4', 'c1', today, shift(10), 100, { status: 'Draft' }) // drafts are not issued
  ],
  payments: [
    { id: 'p1', invoiceId: 'i3', clientId: 'c1', amountReceived: 590, paymentStatus: 'Received', paymentDate: twoMonthsBack.from },
    { id: 'p2', invoiceId: 'i2', clientId: 'c2', amountReceived: 360, paymentStatus: 'Received', paymentDate: today }
  ],
  creditNotes: [],
  expenses: [{ id: 'e1', expenseDate: thisMonth.from, amountBeforeGst: 400, gstRate: 0, totalAmount: 400, status: 'Approved' }],
  outsourcingExpenses: [],
  leadCommissions: [],
  bankAccounts: [],
  bankTransactions: [],
  vendors: [],
  amcs: [],
  renewals: [],
  users: []
};

test('month bounds step back across a year boundary', () => {
  assert.deepEqual(_private.monthBounds('2026-01-15', 1), { from: '2025-12-01', to: '2025-12-31', label: 'Dec' });
  assert.equal(_private.monthBounds('2026-02-10').to, '2026-02-28');
});

test('admin is a super admin or anyone with the admin role', () => {
  assert.equal(_private.isAdmin({ isSuperAdmin: true }), true);
  assert.equal(_private.isAdmin({ roles: [{ code: 'Admin' }] }), true);
  assert.equal(_private.isAdmin({ roles: [{ code: 'sales' }] }), false);
});

test('money: today, this month, outstanding by age and the biggest dues', () => {
  const m = _private.money(state, today);
  assert.equal(m.receivedToday, 360);
  assert.equal(m.receivedThisMonth, 360);
  assert.equal(m.invoicedThisMonth, 1180);
  assert.equal(m.outstanding, 1180 + 2000);
  const aging = Object.fromEntries(m.aging.map((b) => [b.key, b.amount]));
  assert.equal(aging.current, 1180);
  assert.equal(aging.d60, 2000);
  assert.equal(aging.d30 + aging.d90 + aging.d90plus, 0);
  assert.deepEqual(m.topDue.map((row) => [row.name, row.amount]), [['Beta', 2000], ['Alpha', 1180]]);
  assert.equal(m.invoices.unpaid, 2);
  assert.equal(m.invoices.overdue, 1);
  assert.equal(m.invoices.drafts, 1);
  // Six months, oldest first; two months back billed 590 and was paid the same month.
  assert.equal(m.trend.length, 12);
  assert.equal(m.trend[11].from, thisMonth.from);
  const back2 = m.trend[9];
  assert.equal(back2.invoiced, 590);
  assert.equal(back2.received, 590);
  assert.equal(m.trend[11].expense, m.expenseThisMonth);
  assert.equal(m.trend[11].profit, m.profitThisMonth);
});
