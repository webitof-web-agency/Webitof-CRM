const test = require('node:test');
const assert = require('node:assert/strict');
const workday = require('../services/hrm/workday');

// live() takes its db as an argument, so it can run against a scripted one.
function fakeDb(employeeCount) {
  const calls = [];
  const now = new Date();
  const rows = Array.from({ length: employeeCount }, (_, i) => ({
    id: `att${i}`,
    emp_id: `emp${i}`,
    full_name: `Person ${i}`,
    employee_number: `E${i}`,
    designation: 'Dev',
    open_alerts: 0,
    report_id: `rep${i}`,
    report_status: 'Draft',
    report_edits: 0,
    status: 'Present',
    work_mode: 'Office',
    source: 'web',
    check_in: new Date(now - 3600000).toISOString(),
    check_out: null,
    job_started_at: new Date(now - 3000000).toISOString(),
    job_ended_at: null,
    last_ping_at: now.toISOString()
  }));
  return {
    calls,
    async query(sql, params = []) {
      calls.push(sql.replace(/\s+/g, ' ').trim());
      if (/hrm_settings/.test(sql)) return { rows: [] };
      if (/FROM hrm_employees e/.test(sql)) return { rows };
      if (/FROM hrm_work_entries w/.test(sql)) return { rows: [] };
      if (/FROM hrm_attendance_events/.test(sql))
        return {
          rows: [
            { attendance_id: 'att0', kind: 'slot_missed' },
            { attendance_id: 'att0', kind: 'slot_missed' },
            { attendance_id: 'att0', kind: 'exit' }
          ]
        };
      return { rows: [] };
    }
  };
}

const admin = { id: 'hr', permissions: ['hrm.view_all', 'hrm.hr_approve', 'hrm.approve'] };

test('the live board makes a fixed number of queries regardless of how many employees it shows', async () => {
  const small = fakeDb(3);
  const large = fakeDb(60);
  await workday.live(admin, small);
  await workday.live(admin, large);
  assert.equal(small.calls.length, large.calls.length);
  assert.ok(large.calls.length <= 4, `expected at most 4 queries, got ${large.calls.length}`);
});

test('the live board now counts missed slots and breaches in each summary', async () => {
  const result = await workday.live(admin, fakeDb(2));
  const first = result.rows.find((r) => r.employeeId === 'emp0');
  assert.equal(first.summary.slotsMissed, 2);
  assert.equal(first.summary.breaches, 1);
  const second = result.rows.find((r) => r.employeeId === 'emp1');
  assert.equal(second.summary.slotsMissed, 0);
});
