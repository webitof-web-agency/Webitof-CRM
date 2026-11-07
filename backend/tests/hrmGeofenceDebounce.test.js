const test = require('node:test');
const assert = require('node:assert/strict');
const workday = require('../services/hrm/workday');

// ping() against a scripted transaction: the employee is clocked in with a running job, inside an
// all-day shift, tied to a 100 m office fence. We send a position about 9 km away.
function fakeTx(lastLocation) {
  const calls = [];
  const now = new Date();
  const attendance = {
    id: 'att1',
    employee_id: 'emp1',
    work_date: now.toISOString().slice(0, 10),
    check_in: new Date(now - 3600000).toISOString(),
    check_out: null,
    job_started_at: new Date(now - 3000000).toISOString(),
    job_ended_at: null,
    lunch_started_at: null,
    lunch_ended_at: null,
    last_ping_at: new Date(now - 60000).toISOString(),
    last_location: lastLocation,
    geofence_id: 'g1',
    offline_minutes: 0,
    shift_snapshot: { start: '00:00', end: '23:59' }
  };
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/FROM hrm_employees WHERE user_id/.test(sql))
        return { rows: [{ id: 'emp1', user_id: 'u1', full_name: 'Asha', employee_number: 'E1' }] };
      if (/FROM hrm_attendance WHERE employee_id=\$1 AND check_in IS NOT NULL/.test(sql)) return { rows: [attendance] };
      if (/FROM hrm_geofences WHERE id=/.test(sql))
        return { rows: [{ id: 'g1', label: 'HQ', latitude: 28.6139, longitude: 77.209, radius_meters: 100 }] };
      if (/FROM hrm_attendance_events WHERE attendance_id=\$1 AND kind IN/.test(sql)) return { rows: [] };
      if (/^UPDATE hrm_attendance/.test(sql.trim())) return { rows: [attendance] };
      if (/INSERT INTO/.test(sql)) return { rows: [{ id: 'new' }] };
      return { rows: [], rowCount: 0 };
    }
  };
}

const user = { id: 'u1', permissions: ['hrm.self_service'] };
const outside = { latitude: 28.7, longitude: 77.209, accuracy: 10 };
const inserted = (tx, table, needle) =>
  tx.calls.some((c) => new RegExp('INSERT INTO ' + table).test(c.sql) && c.params.includes(needle));

test('a single outside ping does not raise a breach alert or an exit event', async () => {
  const tx = fakeTx(null);
  const result = await workday.ping(user, outside, tx);
  assert.equal(result.inside, false);
  assert.equal(inserted(tx, 'hrm_attendance_events', 'exit'), false);
  assert.ok(!tx.calls.some((c) => /INSERT INTO hrm_alerts/.test(c.sql)), 'no alert on the first stray ping');
  const update = tx.calls.find((c) => /^UPDATE hrm_attendance/.test(c.sql));
  assert.ok(update.params.some((p) => typeof p === 'string' && p.includes('"strikes":1')), 'strike recorded');
});

test('a second consecutive outside ping raises the exit event and the alert', async () => {
  const tx = fakeTx({ latitude: 28.7, longitude: 77.209, accuracy: 10, inside: false, strikes: 1 });
  await workday.ping(user, outside, tx);
  assert.equal(inserted(tx, 'hrm_attendance_events', 'exit'), true);
  assert.ok(tx.calls.some((c) => /INSERT INTO hrm_alerts/.test(c.sql)), 'breach alert opened');
});

test('coming back inside resets the strike count', async () => {
  const tx = fakeTx({ latitude: 28.7, longitude: 77.209, accuracy: 10, inside: false, strikes: 1 });
  await workday.ping(user, { latitude: 28.6139, longitude: 77.209, accuracy: 10 }, tx);
  const update = tx.calls.find((c) => /^UPDATE hrm_attendance/.test(c.sql));
  assert.ok(update.params.some((p) => typeof p === 'string' && p.includes('"strikes":0')));
  assert.equal(inserted(tx, 'hrm_attendance_events', 'exit'), false);
});
