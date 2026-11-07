const test = require('node:test');
const assert = require('node:assert/strict');
const payroll = require('../services/hrm/payroll');

// A scripted transaction: `c.transaction(work, db)` runs `work(db)` directly when a db is given,
// so the payroll action can be exercised without a database.
function fakeTx({ runStatus = 'Draft', archivedEmployee = false } = {}) {
  const calls = [];
  const run = { id: 'run1', status: runStatus, start_date: '2026-09-01', end_date: '2026-09-30', created_by: 'creator' };
  const entries = [
    { id: 'pe1', run_id: 'run1', employee_id: 'emp1', gross: 1000, deductions: 100, net: 900, calculation: { adjustmentIds: [] } },
    { id: 'pe2', run_id: 'run1', employee_id: 'emp2', gross: 2000, deductions: 0, net: 2000, calculation: { adjustmentIds: [] } }
  ];
  const employees = [
    { id: 'emp1', user_id: 'userA', full_name: 'Asha', employee_number: 'E1', archived_at: null },
    { id: 'emp2', user_id: 'userB', full_name: 'Ben', employee_number: 'E2', archived_at: archivedEmployee ? '2026-10-01' : null }
  ];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/FROM hrm_payroll_runs WHERE id=\$1 FOR UPDATE/.test(sql)) return { rows: [run] };
      if (/FROM hrm_payroll_entries WHERE run_id/.test(sql)) return { rows: entries };
      if (/FROM hrm_employees WHERE id=ANY/.test(sql)) return { rows: employees };
      if (/^UPDATE hrm_payroll_runs/.test(sql.trim())) return { rows: [{ ...run, status: params[1] }] };
      if (/INSERT INTO hrm_audit/.test(sql)) return { rows: [{ id: 'audit1' }] };
      if (/INSERT INTO notifications/.test(sql)) return { rows: [{ id: 'n1' }] };
      return { rows: [], rowCount: 0 };
    }
  };
}

const user = { id: 'approver', permissions: ['hrm.payroll', 'hrm.view_salary', 'hrm.approve_payroll'] };

test('voiding a draft run deletes its entries, unlocks attendance and marks the run Voided', async () => {
  const tx = fakeTx({ runStatus: 'Draft' });
  const saved = await payroll.action(user, 'run1', { action: 'void' }, tx);
  assert.equal(saved.status, 'Voided');
  const unlocks = tx.calls.filter((c) => /SET locked_at=NULL/.test(c.sql));
  assert.equal(unlocks.length, 2);
  assert.deepEqual(unlocks.map((c) => c.params[0]).sort(), ['emp1', 'emp2']);
  assert.ok(tx.calls.some((c) => /^DELETE FROM hrm_payroll_entries WHERE run_id/.test(c.sql)));
  assert.ok(tx.calls.some((c) => /INSERT INTO hrm_audit/.test(c.sql)));
});

test('an approved or posted run cannot be voided', async () => {
  for (const status of ['Approved', 'Posted']) {
    await assert.rejects(
      payroll.action(user, 'run1', { action: 'void' }, fakeTx({ runStatus: status })),
      (error) => error.statusCode === 409
    );
  }
});

test('voiding needs payroll or approve_payroll permission', async () => {
  const nobody = { id: 'x', permissions: ['hrm.view_salary'] };
  await assert.rejects(
    payroll.action(nobody, 'run1', { action: 'void' }, fakeTx()),
    (error) => error.statusCode === 403
  );
});

test('one archived employee no longer blocks reviewing the run', async () => {
  const saved = await payroll.action(user, 'run1', { action: 'review' }, fakeTx({ archivedEmployee: true }));
  assert.equal(saved.status, 'Reviewed');
});
