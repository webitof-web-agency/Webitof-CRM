// Dashboard insights: period ranges, health score, cash flow and the morning email.
const test = require('node:test');
const assert = require('node:assert/strict');
const insights = require('../services/dashboardInsights.service');
const { buildDigest } = require('../services/dailyDigest.service');

test('period ranges compare the same span one period earlier', () => {
  assert.deepEqual(
    (({ from, to, prevFrom, prevTo }) => ({ from, to, prevFrom, prevTo }))(insights.periodRange('month', '2026-03-31')),
    { from: '2026-03-01', to: '2026-03-31', prevFrom: '2026-02-01', prevTo: '2026-02-28' }
  );
  const quarter = insights.periodRange('quarter', '2026-05-10');
  assert.equal(quarter.from, '2026-04-01');
  assert.equal(quarter.prevFrom, '2026-01-01');
  assert.equal(quarter.prevTo, '2026-02-10');
  const fy = insights.periodRange('fy', '2026-02-15');
  assert.equal(fy.from, '2025-04-01');
  assert.equal(fy.prevFrom, '2024-04-01');
  assert.equal(insights.periodRange('nonsense', '2026-02-15').key, 'month');
  assert.equal(insights.periodRange('today', '2026-01-01').prevFrom, '2025-12-31');
});

test('health score averages what can be measured and lists the weakest first', () => {
  const health = insights.healthScore({
    money: { outstanding: 1000, overdueOutstanding: 500, period: { current: { revenue: 0, expense: 0, profit: 0 } } },
    followUps: { open: 10, overdue: 9 },
    hrm: { attendance: { shiftStarted: true, total: 4, counts: { present: 3, leave: 0 } } },
    system: { backup: { healthy: true } },
    sales: { openLeads: 10, noNextStep: { count: 0 } }
  });
  assert.deepEqual(health.parts.map((p) => [p.key, p.score]), [['followups', 10], ['collections', 50], ['attendance', 75], ['pipeline', 100], ['backup', 100]]);
  assert.equal(health.score, 67);
  assert.equal(health.grade, 'Fair');
  assert.equal(insights.healthScore({}).score, null);
});

test('cash flow counts invoices due in the window, AMC billing and unpaid bills, not overdue money', () => {
  const today = '2026-11-28';
  const snapshots = [
    { id: 'a', balanceDue: 1000, isOverdue: false, dueDate: '2026-12-10' },
    { id: 'b', balanceDue: 500, isOverdue: true, dueDate: '2026-11-01' },
    { id: 'c', balanceDue: 700, isOverdue: false, dueDate: '2027-01-20' }
  ];
  const state = {
    amcs: [{ status: 'Active', nextInvoiceDate: '2026-12-05', amcAmount: 300 }],
    expenses: [{ status: 'Approved', balanceDue: 200, dueDate: '2026-12-15' }],
    outsourcingExpenses: [],
    payments: [],
    invoices: [],
    creditNotes: []
  };
  const flow = insights.cashFlow(state, snapshots, today);
  assert.equal(flow.overdueIn, 500);
  const [d30, d60] = flow.windows;
  assert.equal(d30.inflow, 1300);
  assert.equal(d30.parts.expensesOut, 200);
  assert.equal(d60.parts.invoicesIn, 1700);
});

test('targets reject nonsense amounts', async () => {
  await assert.rejects(() => insights.saveTargets({ company: -5 }), /between 0/);
  await assert.rejects(() => insights.saveTargets({ people: { 'bad id!': 10 } }), /Unknown person/);
});

test('the morning email escapes names and lists what needs attention', () => {
  const mail = buildDigest(
    {
      today: '2026-11-28',
      money: { receivedThisMonth: 250000, receivedToday: 0, profitThisMonth: -1000, revenueThisMonth: 0, outstanding: 0, overdueOutstanding: 0, gst: { net: 0, daysLeft: 20 } },
      followUps: { overdue: 2, dueToday: 1, overdueItems: [{ title: '<script>x</script>', related: 'Lead', assignedTo: 'A', dueAt: '2026-11-20T05:00:00Z' }] },
      hrm: { approvals: { total: 3 }, alerts: { total: 0 } },
      health: { score: 55, grade: 'Needs attention', parts: [{ key: 'followups', label: 'Follow-ups on time', score: 20 }] },
      todayList: []
    },
    { fullName: 'Hitesh Kumar' }
  );
  assert.match(mail.subject, /Business summary/);
  assert.match(mail.html, /Good morning, Hitesh/);
  assert.match(mail.html, /3 HR request\(s\) waiting for approval/);
  assert.match(mail.html, /Low: Follow-ups on time/);
  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.html, /&lt;script&gt;/);
});
