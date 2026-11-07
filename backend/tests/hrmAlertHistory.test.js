const test = require('node:test');
const assert = require('node:assert/strict');
const workday = require('../services/hrm/workday');

function fakeDb() {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return { rows: [{ id: 'al1', employee_id: 'e1', work_date: '2026-11-01', kind: 'offline', status: 'Resolved' }] };
    }
  };
}
const admin = { id: 'hr', permissions: ['hrm.view_all', 'hrm.hr_approve'] };

test('alerts can be browsed by date range and type', async () => {
  const db = fakeDb();
  const rows = await workday.listAlerts(admin, { from: '2026-11-01', to: '2026-11-07', kind: 'offline' }, db);
  assert.equal(rows.length, 1);
  const { sql, params } = db.calls[0];
  assert.match(sql, /a\.work_date>=\$1/);
  assert.match(sql, /a\.work_date<=\$2/);
  assert.match(sql, /a\.kind=\$3/);
  assert.deepEqual(params, ['2026-11-01', '2026-11-07', 'offline']);
});

test('the open filter still excludes resolved alerts and the old single-day filter still works', async () => {
  const db = fakeDb();
  await workday.listAlerts(admin, { status: 'open', date: '2026-11-03' }, db);
  assert.match(db.calls[0].sql, /a\.status<>'Resolved'/);
  assert.deepEqual(db.calls[0].params, ['2026-11-03']);
});

test('a malformed date range is rejected instead of reaching the database', async () => {
  const db = fakeDb();
  await assert.rejects(workday.listAlerts(admin, { from: 'yesterday' }, db), (e) => e.statusCode === 400);
  assert.equal(db.calls.length, 0);
});

test('viewing alerts needs an approver permission', async () => {
  await assert.rejects(workday.listAlerts({ id: 'x', permissions: [] }, {}, fakeDb()), (e) => e.statusCode === 403);
});
