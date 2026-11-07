const test = require('node:test');
const assert = require('node:assert/strict');
const operations = require('../services/hrm/operations');

// Scripted transaction (see hrmPayroll.test.js): approveRequest runs against it directly.
function fakeTx({ startDate, locked = false } = {}) {
  const calls = [];
  const request = {
    id: 'req1',
    employee_id: 'emp1',
    kind: 'leave',
    status: 'Approved',
    start_date: startDate,
    end_date: startDate,
    details: { paid: true, days: 2, leaveTypeId: 'lt1' },
    version: 1
  };
  const employee = { id: 'emp1', user_id: 'userA', full_name: 'Asha', employee_number: 'E1', version: 1 };
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/FROM hrm_requests WHERE id=\$1 FOR UPDATE/.test(sql)) return { rows: [request] };
      if (/FROM hrm_employees e WHERE/.test(sql)) return { rows: [employee] };
      if (/FROM hrm_payroll_entries pe/.test(sql)) return { rows: locked ? [{ id: 'pe1' }] : [], rowCount: locked ? 1 : 0 };
      if (/^UPDATE hrm_requests/.test(sql.trim())) return { rows: [{ ...request, status: params[1] }] };
      if (/INSERT INTO/.test(sql)) return { rows: [{ id: 'new1' }] };
      return { rows: [], rowCount: 0 };
    }
  };
}

const owner = { id: 'userA', permissions: ['hrm.self_service', 'hrm.view_own'] };
const hr = { id: 'hrUser', permissions: ['hrm.hr_approve', 'hrm.view_all'] };
const stranger = { id: 'userC', permissions: ['hrm.self_service', 'hrm.view_all'] };

test('an employee can cancel approved leave that has not started: balance refunded, marks cleared', async () => {
  const tx = fakeTx({ startDate: '2099-01-05' });
  const saved = await operations.approveRequest(owner, 'req1', { action: 'cancel' }, tx);
  assert.equal(saved.status, 'Cancelled');
  const refund = tx.calls.find((c) => /INSERT INTO hrm_leave_ledger/.test(c.sql));
  assert.ok(refund, 'ledger refund row written');
  assert.ok(refund.params.includes(2), 'refunds the leave days as a positive amount');
  assert.ok(refund.params.includes('leave-cancel:req1'), 'idempotent source key');
  assert.ok(tx.calls.some((c) => /^DELETE FROM hrm_attendance/.test(c.sql)), 'leave attendance rows removed');
});

test('leave that has already started can only be cancelled by HR', async () => {
  await assert.rejects(
    operations.approveRequest(owner, 'req1', { action: 'cancel' }, fakeTx({ startDate: '2000-01-05' })),
    (error) => error.statusCode === 409
  );
  const saved = await operations.approveRequest(hr, 'req1', { action: 'cancel' }, fakeTx({ startDate: '2000-01-05' }));
  assert.equal(saved.status, 'Cancelled');
});

test('someone without HR approval cannot cancel another employee\'s approved leave', async () => {
  await assert.rejects(
    operations.approveRequest(stranger, 'req1', { action: 'cancel' }, fakeTx({ startDate: '2099-01-05' })),
    (error) => error.statusCode === 403
  );
});

test('approved leave in a payroll-locked period cannot be cancelled', async () => {
  await assert.rejects(
    operations.approveRequest(owner, 'req1', { action: 'cancel' }, fakeTx({ startDate: '2099-01-05', locked: true })),
    (error) => error.statusCode === 409
  );
});
