const test = require('node:test');
const assert = require('node:assert/strict');
const { menuCounts } = require('../services/hrm/menuCounts');

// Fake database: answers each count query by what it counts.
function fakeDb() {
  return {
    query: async (sql) => {
      if (sql.includes('hrm_settings')) return { rows: [] };
      if (sql.includes('GROUP BY r.kind')) return { rows: [{ kind: 'leave', n: 2 }, { kind: 'reimbursement', n: 1 }] };
      if (sql.includes("al.status = 'Explanation Requested'")) return { rows: [{ n: 1 }] };
      if (sql.includes('FROM hrm_alerts')) return { rows: [{ n: 3 }] };
      if (sql.includes('hrm_work_reports')) return { rows: [{ n: 4 }] };
      if (sql.includes('hrm_timesheets')) throw new Error('relation "hrm_timesheets" does not exist');
      if (sql.includes('hrm_geofences')) return { rows: [{ n: 1 }] };
      if (sql.includes('hrm_documents')) return { rows: [{ n: 5 }] };
      return { rows: [{ n: 0 }] };
    },
  };
}

test('menu counts follow the overview: approvals by kind, alerts, and a parent total counting each item once', async () => {
  const user = { id: 'u1', isSuperAdmin: true, permissions: [] };
  const original = console.error;
  console.error = () => {};
  try {
    const counts = await menuCounts(user, fakeDb());
    assert.equal(counts['/app/hrm/leave'], 2);
    assert.equal(counts['/app/hrm/reimbursement'], 1);
    assert.equal(counts['/app/hrm/regularization'], 0);
    // Overview = waiting for approval (3) + alerts (3).
    assert.equal(counts['/app/hrm/overview'], 6);
    assert.equal(counts['/app/hrm/work-reports'], 4);
    // A failing optional count is 0, not an error.
    assert.equal(counts['/app/hrm/timesheets'], 0);
    assert.equal(counts['/app/hrm/geofences'], 1);
    assert.equal(counts['/app/hrm/documents'], 5);
    assert.equal(counts['/app/hrm/my-day'], 1);
    // Parent: 3 approvals + 3 alerts + 4 reports + 1 home + 5 documents + 1 explain (+ zeros) = 17.
    assert.equal(counts['/app/hrm'], 17);
    assert.equal(counts.approvals, undefined);
  } finally {
    console.error = original;
  }
});

test('an employee without approval rights gets only their own to-do', async () => {
  const user = { id: 'u2', permissions: ['hrm.view_own', 'hrm.self_service'] };
  const counts = await menuCounts(user, fakeDb());
  assert.deepEqual(Object.keys(counts).sort(), ['/app/hrm', '/app/hrm/my-day']);
  assert.equal(counts['/app/hrm'], 1);
});
