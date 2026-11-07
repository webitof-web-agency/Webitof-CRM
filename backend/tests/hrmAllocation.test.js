const test = require('node:test');
const assert = require('node:assert/strict');
const work = require('../services/hrm/work');

function fakeTx(existing = []) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/FROM hrm_employees e WHERE/.test(sql))
        return { rows: [{ id: 'emp1', user_id: 'u9', full_name: 'Asha', joining_date: '2020-01-01', exit_date: null }] };
      if (/FROM projects WHERE id=/.test(sql)) return { rows: [{ id: 'p1', payload: {} }] };
      if (/FROM hrm_allocations WHERE employee_id=\$1 AND start_date<=/.test(sql)) return { rows: existing };
      if (/INSERT INTO/.test(sql)) return { rows: [{ id: 'new1' }] };
      return { rows: [], rowCount: 0 };
    }
  };
}
const user = { id: 'hr', permissions: ['hrm.manage_allocations', 'hrm.view_all'] };
const base = { employeeId: 'emp1', projectId: 'p1', role: 'Developer', percent: 50 };
const allocation = (body, tx) => work.allocation(user, { ...base, ...body }, null, tx);

test('an allocation longer than a year is allowed (previously capped at 367 days)', async () => {
  const tx = fakeTx();
  await allocation({ startDate: '2026-01-01', endDate: '2028-12-31' }, tx);
  assert.ok(tx.calls.some((c) => /INSERT INTO hrm_allocations/.test(c.sql)));
});

test('both dates are required and the end cannot precede the start', async () => {
  await assert.rejects(allocation({ startDate: '2026-01-01' }, fakeTx()), (e) => e.statusCode === 400);
  await assert.rejects(allocation({ endDate: '2026-12-31' }, fakeTx()), (e) => e.statusCode === 400);
  await assert.rejects(allocation({ startDate: '2026-06-01', endDate: '2026-05-01' }, fakeTx()), (e) => e.statusCode === 400);
});

test('an allocation can span at most five years', async () => {
  await assert.rejects(allocation({ startDate: '2026-01-01', endDate: '2032-06-01' }, fakeTx()), (e) => /5 years/.test(e.message));
});

test('overlapping load above 100% is rejected on the days it happens', async () => {
  const existing = [{ id: 'a1', percent: 60, start_date: '2026-03-01', end_date: '2026-12-31' }];
  await assert.rejects(
    allocation({ percent: 50, startDate: '2026-01-01', endDate: '2026-12-31' }, fakeTx(existing)),
    (e) => /exceeds available percentage/.test(e.message)
  );
});

test('a short overlap that stays within 100% passes, and so does load that ends before the new one starts', async () => {
  const within = [{ id: 'a1', percent: 40, start_date: '2026-06-01', end_date: '2026-06-30' }];
  await allocation({ percent: 50, startDate: '2026-01-01', endDate: '2026-12-31' }, fakeTx(within));
  const before = [{ id: 'a2', percent: 90, start_date: '2025-01-01', end_date: '2025-12-31' }];
  await allocation({ percent: 90, startDate: '2026-01-01', endDate: '2026-12-31' }, fakeTx(before));
});

test('a heavy allocation that ends the day before the new one starts does not count as overlap', async () => {
  const touching = [{ id: 'a3', percent: 80, start_date: '2026-01-01', end_date: '2026-03-31' }];
  await allocation({ percent: 80, startDate: '2026-04-01', endDate: '2026-12-31' }, fakeTx(touching));
});
