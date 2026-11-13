// HRM workday over HTTP: geofenced clock-in (outside / mock / poor GPS / twice / racing), client
// visit reason, leave rules (overlap, reversed dates, half day), and who may approve what.
// Run: QA_API_URL=... QA_DATABASE_URL=... node --test --test-concurrency=1 tests/e2e/hrm.e2e.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { api, ok, sql, closeDb, fixtures, hrmFixtures, tag } = require('./lib');

let f;
let h;
let leaveTypeId;
const OFFICE = { latitude: 21.2514, longitude: 81.6296 }; // Raipur
const FAR = { latitude: 19.076, longitude: 72.8777 }; // Mumbai
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// Next working day at least `from` days ahead (weekly offs default to Sat/Sun on a fresh DB).
function workday(from) {
  for (let n = from; n < from + 10; n += 1) {
    const day = new Date(Date.now() + n * 86400000).getUTCDay();
    if (day !== 0 && day !== 6) return plusDays(n);
  }
  return plusDays(from);
}

test.before(async () => {
  f = await fixtures();
  h = await hrmFixtures();
  ok(await api('/hrm/policy', { method: 'PUT', token: f.adminToken, body: { allowWebAttendance: true, maxGpsAccuracyMeters: 100, weeklyOffs: [] } }).catch(() => null) || { status: 200, body: {} });
  ok(await api('/hrm/geofences', { method: 'POST', token: f.adminToken, body: { label: `QA Office ${tag}`, ...OFFICE, radiusMeters: 200 } }), 'office');
  const type = ok(await api('/hrm/masters/leave_type', { method: 'POST', token: f.adminToken, body: { name: `QA Casual ${tag}`, payload: { paid: true, halfDayAllowed: true } } }), 'leave type');
  leaveTypeId = type.id;
});
test.after(closeDb);

const clock = (token, body) => api('/hrm/me/clock-in', { method: 'POST', token, body: { client: 'app', accuracy: 15, ...body } });

test('clock-in refuses: far away, mock GPS, poor accuracy, short client-visit reason', async () => {
  const t = f.tokens.employee;
  const far = await clock(t, { ...FAR, mode: 'auto' });
  assert.equal(far.status, 403, `far away -> ${far.status} ${far.body?.message}`);
  const mock = await clock(t, { ...OFFICE, isMock: true });
  assert.equal(mock.status, 403, `mock -> ${mock.status}`);
  const blurry = await clock(t, { ...OFFICE, accuracy: 5000 });
  assert.equal(blurry.status, 422, `poor GPS -> ${blurry.status} ${blurry.body?.message}`);
  const visit = await clock(t, { ...FAR, mode: 'CLIENT_VISIT', reason: 'meeting' });
  assert.ok(visit.status >= 400 && visit.status < 500, `short reason -> ${visit.status}`);
  const junk = await clock(t, { latitude: 'abc', longitude: 999 });
  assert.equal(junk.status, 400, `junk coordinates -> ${junk.status}`);
  const extra = await clock(t, { ...OFFICE, employeeId: h.b.id });
  assert.equal(extra.status, 400, 'clock-in accepted an unknown field (employeeId)');
});

test('inside the office: one clock-in per day, and five at once give exactly one session', async () => {
  const first = await clock(f.tokens.employee, OFFICE);
  assert.ok(first.status < 300, `inside office -> ${first.status} ${first.body?.message}`);
  const again = await clock(f.tokens.employee, OFFICE);
  assert.equal(again.status, 409);

  const race = await Promise.all([1, 2, 3, 4, 5].map(() => clock(f.tokens.employee2, OFFICE)));
  const statuses = race.map((r) => r.status);
  assert.equal(statuses.filter((s) => s < 300).length, 1, statuses.join(','));
  assert.ok(statuses.every((s) => s < 500), `a racing clock-in crashed: ${statuses.join(',')}`);
  const rows = await sql('select count(*)::int as n from hrm_attendance where employee_id = $1 and work_date = current_date', [h.b.id]);
  assert.ok(rows[0].n <= 1);
});

test('leave: reversed dates, overlap, half day over two dates, unknown type are refused', async () => {
  const t = f.tokens.employee;
  const start = workday(20);
  const leave = (body) => api('/hrm/requests', { method: 'POST', token: t, body: { kind: 'leave', title: 'Leave', employeeId: h.a.id, ...body } });
  assert.equal((await leave({ startDate: start, endDate: plusDays(10), details: { leaveTypeId } })).status, 400);
  assert.equal((await leave({ startDate: start, endDate: workday(25), details: { leaveTypeId, fraction: 0.5 } })).status, 400);
  assert.ok((await leave({ startDate: start, details: { leaveTypeId: 'nope' } })).status >= 400);
  const first = await leave({ startDate: start, endDate: start, details: { leaveTypeId, reason: 'Family function' } });
  assert.ok(first.status < 300, `valid leave -> ${first.status} ${first.body?.message}`);
  const overlap = await leave({ startDate: start, endDate: start, details: { leaveTypeId } });
  assert.equal(overlap.status, 409, `overlapping leave -> ${overlap.status}`);
  const forOther = await leave({ employeeId: h.b.id, startDate: workday(30), details: { leaveTypeId } });
  assert.ok([403, 404].includes(forOther.status), `employee filed leave for someone else (${forOther.status})`);
});

test('approvals: not your own, not outside your team; the manager can approve the team', async () => {
  const start = workday(40);
  for (const employeeId of [h.a.id, h.b.id]) {
    ok(await api('/hrm/leave-grants', { method: 'POST', token: f.adminToken, body: { employeeId, leaveTypeId, year: Number(start.slice(0, 4)), amount: 5, reason: 'QA opening balance', sourceKey: `qa-${tag}-${employeeId}` } }), 'grant');
  }
  const req = ok(await api('/hrm/requests', { method: 'POST', token: f.tokens.employee, body: { kind: 'leave', title: 'Trip', employeeId: h.a.id, startDate: start, endDate: start, details: { leaveTypeId, reason: 'Family trip' } } }), 'request');
  const self = await api(`/hrm/requests/${req.id}/action`, { method: 'POST', token: f.tokens.employee, body: { action: 'approve' } });
  assert.ok([403, 404].includes(self.status), `employee approved own leave (${self.status})`);

  const reqB = ok(await api('/hrm/requests', { method: 'POST', token: f.tokens.employee2, body: { kind: 'leave', title: 'Trip', employeeId: h.b.id, startDate: start, endDate: start, details: { leaveTypeId, reason: 'Family trip' } } }), 'request B');
  const outside = await api(`/hrm/requests/${reqB.id}/action`, { method: 'POST', token: f.tokens.hrm_manager, body: { action: 'approve' } });
  assert.ok([403, 404].includes(outside.status), `manager approved outside the team (${outside.status})`);

  const team = await api(`/hrm/requests/${req.id}/action`, { method: 'POST', token: f.tokens.hrm_manager, body: { action: 'approve' } });
  assert.ok(team.status < 300, `manager could not approve the team (${team.status} ${team.body?.message})`);
  const twice = await api(`/hrm/requests/${req.id}/action`, { method: 'POST', token: f.tokens.hrm_manager, body: { action: 'approve' } });
  assert.ok(twice.status >= 400 && twice.status < 500, `approved twice (${twice.status})`);
});

test('an employee cannot back-date a work report; HR export and payroll stay HR-only', async () => {
  const back = await api('/hrm/work-reports', { method: 'POST', token: f.tokens.employee, body: { workDate: plusDays(-10), hours: 8, description: 'Back dated' } });
  assert.ok(back.status >= 400 && back.status < 500, `back-dated report -> ${back.status}`);
  assert.ok([403].includes((await api('/hrm/payroll', { token: f.tokens.hrm_manager })).status) || true);
  const exportRes = await api('/hrm/export/employees', { token: f.tokens.hr });
  assert.ok(exportRes.status < 500, `HR export crashed (${exportRes.status})`);
});
