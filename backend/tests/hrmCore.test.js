const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../services/hrm/core');

test('post-commit side effects run with bounded concurrency and one failure does not stop the rest', async () => {
  let running = 0;
  let peak = 0;
  let finished = 0;
  const hooks = Array.from({ length: 40 }, () => async () => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 2));
    running -= 1;
    finished += 1;
  });
  hooks.splice(5, 0, async () => {
    throw new Error('push provider down');
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    await c.runHooks(hooks, 8);
  } finally {
    console.error = originalError;
  }
  assert.equal(finished, 40);
  assert.ok(peak <= 8, `peak concurrency was ${peak}`);
});

test('payrollLocked is true only when a run covers the range', async () => {
  const db = (rowCount) => ({
    async query(sql, params) {
      assert.match(sql, /hrm_payroll_entries pe JOIN hrm_payroll_runs p/);
      assert.deepEqual(params, ['emp1', '2026-09-10', '2026-09-12']);
      return { rowCount, rows: rowCount ? [{}] : [] };
    }
  });
  assert.equal(await c.payrollLocked(db(1), 'emp1', '2026-09-10', '2026-09-12'), true);
  assert.equal(await c.payrollLocked(db(0), 'emp1', '2026-09-10', '2026-09-12'), false);
});

test('payrollLocked checks a single day when no end is given', async () => {
  let seen;
  await c.payrollLocked({ async query(_sql, params) { seen = params; return { rowCount: 0, rows: [] }; } }, 'emp1', '2026-09-10');
  assert.deepEqual(seen, ['emp1', '2026-09-10', '2026-09-10']);
});
