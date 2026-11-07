// The follow-up automation cycle: one bad item must not block the rest. Runs against a scripted database.
const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../config/db');
let current = null;
config.withTransaction = async (work) => work(current);

const engine = require('../services/followUpEngine.service');

const reminder = (n) => ({
  id: 'r' + n,
  follow_up_id: 'f' + n,
  recipient_user_id: 'u1',
  channel: 'inApp',
  title: 'Call client',
  follow_up_number: 'FU-' + n,
  priority: 'High',
  related_entity_label: 'Lead'
});

function scriptedDb({ lockGranted = true, reminders = [], enrollments = [], failFollowUps = [], failEnrollments = [] } = {}) {
  const log = [];
  return {
    log,
    async query(sql, params = []) {
      const text = sql.replace(/\s+/g, ' ').trim();
      log.push({ text, params });
      if (/pg_try_advisory_xact_lock/.test(text)) return { rows: [{ locked: lockGranted }], rowCount: 1 };
      if (/^(savepoint|release savepoint|rollback to savepoint)/.test(text)) return { rows: [] };
      if (/from follow_up_reminders r join follow_ups f/.test(text)) return { rows: reminders, rowCount: reminders.length };
      if (/insert into notifications/.test(text) && failFollowUps.includes(params[2])) throw new Error('notification failed for ' + params[2]);
      if (/from follow_up_sequence_enrollments where status = 'Active'/.test(text)) return { rows: enrollments, rowCount: enrollments.length };
      if (/from follow_up_sequence_steps where sequence_id/.test(text)) {
        if (failEnrollments.includes(params[0])) throw new Error('lead was deleted');
        return { rows: [] };
      }
      if (/^update payment_promises/.test(text)) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    }
  };
}
const ran = (db, pattern) => db.log.filter((entry) => pattern.test(entry.text));

test('one failing reminder does not stop the others, and it is skipped instead of retried forever', async () => {
  const db = scriptedDb({ reminders: [reminder(1), reminder(2), reminder(3)], failFollowUps: ['f2'] });
  current = db;
  const originalError = console.error;
  console.error = () => {};
  let result;
  try {
    result = await engine.runAutomationCycle({ runSource: 'test' });
  } finally {
    console.error = originalError;
  }
  assert.equal(result.remindersSent, 2, 'reminders 1 and 3 were delivered');
  assert.equal(result.failed, 1);
  const notifications = ran(db, /insert into notifications/).map((entry) => entry.params[2]);
  assert.deepEqual(notifications, ['f1', 'f2', 'f3'], 'delivery was attempted for every reminder');
  assert.equal(ran(db, /^rollback to savepoint/).length, 1, 'only the failed item was rolled back');
  const skipped = ran(db, /update follow_up_reminders set status='skipped', failure_reason=\$2/);
  assert.equal(skipped.length, 1);
  assert.deepEqual(skipped[0].params[0], 'r2');
  assert.match(skipped[0].params[1], /Delivery failed: notification failed for f2/);
  assert.ok(ran(db, /insert into workflow_automation_logs/).length === 1, 'the cycle is still logged');
});

test('a failing sequence enrollment backs off for an hour and the others still run', async () => {
  const enrollment = (id) => ({ id, sequence_id: 'seq-' + id, current_step_order: 0, related_entity_type: 'Lead', related_entity_id: 'lead1', started_by: 'u1' });
  const db = scriptedDb({ enrollments: [enrollment('e1'), enrollment('e2')], failEnrollments: ['seq-e1'] });
  current = db;
  const originalError = console.error;
  console.error = () => {};
  let result;
  try {
    result = await engine.runAutomationCycle({ runSource: 'test' });
  } finally {
    console.error = originalError;
  }
  assert.equal(result.failed, 1);
  const backoff = ran(db, /set next_run_at = now\(\) \+ interval '1 hour'/);
  assert.equal(backoff.length, 1);
  assert.deepEqual(backoff[0].params, ['e1']);
  // e2 had no step left: it was completed, not blocked behind e1.
  assert.equal(ran(db, /set status='Completed', next_run_at=null/).length, 1);
});

test('a cycle that cannot get the lock does nothing', async () => {
  const db = scriptedDb({ lockGranted: false, reminders: [reminder(1)] });
  current = db;
  const result = await engine.runAutomationCycle({ runSource: 'test' });
  assert.equal(result.skipped, true);
  assert.equal(ran(db, /insert into notifications/).length, 0);
  assert.equal(ran(db, /insert into workflow_automation_logs/).length, 0);
});

test('a healthy cycle reports no failures', async () => {
  const db = scriptedDb({ reminders: [reminder(1), reminder(2)] });
  current = db;
  const result = await engine.runAutomationCycle({ runSource: 'test' });
  assert.equal(result.remindersSent, 2);
  assert.equal(result.failed, 0);
  assert.equal(ran(db, /^rollback to savepoint/).length, 0);
});
