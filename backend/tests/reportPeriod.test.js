const test = require('node:test');
const assert = require('node:assert/strict');
const { parseReportPeriod, filterStateByPeriod, buildFinanceSummary } = require('../services/finance.service');

const bounds = (query, today) => {
  const { from, to, label } = parseReportPeriod(query, today);
  return { from, to, label };
};

test('financial years run April to March, including on the boundary days', () => {
  assert.deepEqual(bounds({ period: 'thisFy' }, '2026-11-05'), { from: '2026-04-01', to: '2027-03-31', label: 'FY 2026-27' });
  assert.deepEqual(bounds({ period: 'thisFy' }, '2027-02-10'), { from: '2026-04-01', to: '2027-03-31', label: 'FY 2026-27' });
  assert.deepEqual(bounds({ period: 'thisFy' }, '2026-03-31'), { from: '2025-04-01', to: '2026-03-31', label: 'FY 2025-26' });
  assert.deepEqual(bounds({ period: 'thisFy' }, '2026-04-01'), { from: '2026-04-01', to: '2027-03-31', label: 'FY 2026-27' });
  assert.deepEqual(bounds({ period: 'lastFy' }, '2026-11-05'), { from: '2025-04-01', to: '2026-03-31', label: 'FY 2025-26' });
  assert.deepEqual(bounds({ period: 'lastFy' }, '2026-02-01'), { from: '2024-04-01', to: '2025-03-31', label: 'FY 2024-25' });
});

test('an explicit financial year is accepted and a wrong one is not', () => {
  assert.deepEqual(bounds({ fy: '2025-26' }), { from: '2025-04-01', to: '2026-03-31', label: 'FY 2025-26' });
  assert.deepEqual(bounds({ fy: '2099-00' }), { from: '2099-04-01', to: '2100-03-31', label: 'FY 2099-00' });
  for (const fy of ['2025-27', '25-26', '2025', 'abc']) {
    assert.throws(() => parseReportPeriod({ fy }), (e) => e.statusCode === 400, fy);
  }
});

test('this month and last month handle January and leap February', () => {
  assert.deepEqual(bounds({ period: 'thisMonth' }, '2026-11-05'), { from: '2026-11-01', to: '2026-11-30', label: 'This month' });
  assert.deepEqual(bounds({ period: 'lastMonth' }, '2026-11-05'), { from: '2026-10-01', to: '2026-10-31', label: 'Last month' });
  assert.deepEqual(bounds({ period: 'lastMonth' }, '2026-01-15'), { from: '2025-12-01', to: '2025-12-31', label: 'Last month' });
  assert.deepEqual(bounds({ period: 'lastMonth' }, '2024-03-10'), { from: '2024-02-01', to: '2024-02-29', label: 'Last month' });
  assert.deepEqual(bounds({ period: 'lastMonth' }, '2026-03-10'), { from: '2026-02-01', to: '2026-02-28', label: 'Last month' });
});

test('custom dates are validated; no period means all time', () => {
  assert.equal(parseReportPeriod({}).active, false);
  assert.equal(parseReportPeriod({ period: 'all' }).active, false);
  assert.deepEqual(bounds({ from: '2026-04-01', to: '2026-06-30' }), { from: '2026-04-01', to: '2026-06-30', label: '2026-04-01 to 2026-06-30' });
  assert.equal(parseReportPeriod({ from: '2026-04-01' }).to, '', 'an open end is allowed');
  for (const query of [{ from: '2026-06-30', to: '2026-04-01' }, { from: '2026-13-01' }, { from: '2026-02-30' }, { to: 'tomorrow' }]) {
    assert.throws(() => parseReportPeriod(query), (e) => e.statusCode === 400, JSON.stringify(query));
  }
});

const inv = (id, invoiceDate) => ({
  id,
  status: 'Sent',
  invoiceDate,
  dueDate: '2099-01-01',
  clientId: 'c1',
  amountType: 'No Tax',
  items: [{ description: 'Work', quantity: 1, rate: 1000, gstRate: 0 }]
});
const state = {
  settings: {},
  clients: [{ id: 'c1', companyName: 'Acme' }],
  invoices: [inv('a', '2026-03-31'), inv('b', '2026-04-01'), inv('c', '2027-03-31'), inv('d', '2027-04-01')],
  expenses: [
    { id: 'e1', expenseDate: '2026-05-01', expenseType: 'Office', totalAmount: 100, amountBeforeGst: 100 },
    { id: 'e2', expenseDate: '2027-04-02', expenseType: 'Office', totalAmount: 900, amountBeforeGst: 900 }
  ],
  payments: [],
  outsourcingExpenses: [],
  leadCommissions: [],
  bankAccounts: [],
  bankTransactions: [],
  users: [{ id: 'u1', fullName: 'Asha', salary: 50000, isActive: true }]
};

test('the period filter is inclusive of both end dates and limits every collection', () => {
  const filtered = filterStateByPeriod(state, parseReportPeriod({ fy: '2026-27' }));
  assert.deepEqual(filtered.invoices.map((i) => i.id), ['b', 'c']);
  assert.deepEqual(filtered.expenses.map((e) => e.id), ['e1']);
  assert.equal(state.invoices.length, 4, 'the original state is untouched');
});

test('an inactive period returns the state unchanged', () => {
  assert.equal(filterStateByPeriod(state, parseReportPeriod({})), state);
});

test('a period never invents a payroll cost from user salaries', () => {
  const all = buildFinanceSummary(state);
  assert.ok(all.totalPayrollExpense > 0, 'without a period the per-user fallback still applies');
  const periodSummary = buildFinanceSummary(filterStateByPeriod(state, parseReportPeriod({ fy: '2026-27' })));
  assert.equal(periodSummary.totalPayrollExpense, 0);
  assert.equal(periodSummary.totalInvoiceAmount, 2000);
  assert.equal(periodSummary.totalExpenses, 100);
});
