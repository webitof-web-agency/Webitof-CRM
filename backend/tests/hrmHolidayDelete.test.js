const test = require('node:test');
const assert = require('node:assert/strict');
const queries = require('../services/hrm/queries');

function fakeTx({ exists = true, locked = false } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/FROM hrm_holidays WHERE id=\$1 FOR UPDATE/.test(sql))
        return { rows: exists ? [{ id: 'h1', name: 'Diwali', work_date: '2026-11-08' }] : [] };
      if (/FROM hrm_payroll_runs r JOIN hrm_payroll_entries/.test(sql))
        return { rowCount: locked ? 1 : 0, rows: locked ? [{}] : [] };
      if (/INSERT INTO hrm_audit/.test(sql)) return { rows: [{ id: 'a1' }] };
      return { rows: [], rowCount: 0 };
    }
  };
}
const admin = { id: 'u1', permissions: ['hrm.manage_settings'] };

test('a holiday can be deleted and the deletion is audited', async () => {
  const tx = fakeTx();
  const result = await queries.removeHoliday(admin, 'h1', tx);
  assert.deepEqual(result, { id: 'h1', deleted: true });
  assert.ok(tx.calls.some((c) => /^DELETE FROM hrm_holidays/.test(c.sql)));
  assert.ok(tx.calls.some((c) => /INSERT INTO hrm_audit/.test(c.sql)));
});

test('a holiday inside a payroll-covered period cannot be deleted', async () => {
  const tx = fakeTx({ locked: true });
  await assert.rejects(queries.removeHoliday(admin, 'h1', tx), (e) => e.statusCode === 409);
  assert.ok(!tx.calls.some((c) => /^DELETE FROM hrm_holidays/.test(c.sql)));
});

test('deleting needs manage_settings and a real holiday', async () => {
  await assert.rejects(queries.removeHoliday({ id: 'x', permissions: [] }, 'h1', fakeTx()), (e) => e.statusCode === 403);
  await assert.rejects(queries.removeHoliday(admin, 'missing', fakeTx({ exists: false })), (e) => e.statusCode === 404);
});
