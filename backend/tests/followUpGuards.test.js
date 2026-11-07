// Follow-up state rules: closed items stay closed, manual status changes are limited, owner changes need the
// reassign permission, date edits take effect and snooze honours its minutes. Scripted database, no real one.
const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../config/db');
const followUpModel = require('../models/followUp.model');

const calls = [];
const db = {
  async query(sql, params = []) {
    calls.push(sql.replace(/\s+/g, ' ').trim());
    if (/select id from users where id = \$1/.test(sql)) return { rows: [{ id: params[0] }] };
    return { rows: [], rowCount: 0 };
  }
};
config.withTransaction = async (work) => work(db);

let stored = null;
const writes = [];
followUpModel.findById = async () => stored;
followUpModel.update = async (id, values) => {
  writes.push(values);
  return { ...stored, ...values };
};

const engine = require('../services/followUpEngine.service');

const followUp = (status, extra = {}) => ({
  id: 'f1',
  status,
  title: 'Call client',
  priority: 'Medium',
  assignedTo: 'owner',
  createdBy: 'owner',
  timezone: 'Asia/Kolkata',
  dueAt: '2099-06-10T04:30:00.000Z', // 10:00 IST
  version: 1,
  rescheduleCount: 0,
  snoozeCount: 0,
  escalationLevel: 2,
  relatedEntityType: 'Lead',
  relatedEntityId: 'lead1',
  ...extra
});
const owner = { id: 'owner', permissions: ['followups.edit_own', 'followups.complete', 'followups.reschedule'] };
const manager = { id: 'mgr', permissions: ['followups.edit_any', 'followups.reassign', 'followups.escalate', 'followups.reschedule', 'followups.complete'] };
const status = async (promise) => {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    return error.statusCode;
  }
};

test.beforeEach(() => {
  stored = followUp('Scheduled');
  writes.length = 0;
  calls.length = 0;
});

test('closed follow-ups cannot be started, rescheduled, snoozed, reassigned or escalated', async () => {
  for (const closed of ['Completed', 'Cancelled', 'Failed', 'Auto-Closed']) {
    stored = followUp(closed);
    const future = { reason: 'later', date: '2099-12-01', time: '10:00' };
    assert.equal(await status(engine.markInProgress('f1', manager)), 400, closed + ' start');
    assert.equal(await status(engine.rescheduleFollowUp('f1', future, manager)), 400, closed + ' reschedule');
    assert.equal(await status(engine.rescheduleFollowUp('f1', { reason: 'later', minutes: 30 }, manager, 'snooze')), 400, closed + ' snooze');
    assert.equal(await status(engine.reassignFollowUp('f1', { assignedTo: 'someone' }, manager)), 400, closed + ' reassign');
    assert.equal(await status(engine.escalateFollowUp('f1', { reason: 'x' }, manager)), 400, closed + ' escalate');
  }
  assert.equal(writes.length, 0, 'nothing was written to a closed follow-up');
});

test('a closed follow-up can still get notes but not a new status or time', async () => {
  stored = followUp('Completed');
  assert.equal(await status(engine.updateFollowUp('f1', { status: 'Scheduled' }, manager)), 400);
  assert.equal(await status(engine.updateFollowUp('f1', { date: '2099-12-01', time: '10:00' }, manager)), 400);
  assert.equal(await status(engine.updateFollowUp('f1', { priority: 'High' }, manager)), 400);
  assert.equal(await status(engine.updateFollowUp('f1', { internalNote: 'remember this' }, manager)), 'ok');
  assert.equal(writes[0].internalNote, 'remember this');
});

test('an edit form that echoes the unchanged schedule and status is not treated as a change', async () => {
  stored = followUp('Completed');
  const echo = { status: 'Completed', date: '2099-06-10', time: '10:00', dueAt: stored.dueAt, priority: 'Medium', assignedTo: 'owner', internalNote: 'ok' };
  assert.equal(await status(engine.updateFollowUp('f1', echo, manager)), 'ok');
});

test('manual status changes: active states and Cancelled only; "Overdue" is just an echo', async () => {
  assert.equal(await status(engine.updateFollowUp('f1', { status: 'Completed' }, owner)), 400);
  assert.equal(await status(engine.updateFollowUp('f1', { status: 'Failed' }, owner)), 400);
  assert.equal(await status(engine.updateFollowUp('f1', { status: 'Auto-Closed' }, owner)), 400);
  assert.equal(await status(engine.updateFollowUp('f1', { status: 'Waiting for Client' }, owner)), 'ok');
  assert.equal(await status(engine.updateFollowUp('f1', { status: 'Cancelled' }, owner)), 'ok');
  assert.equal(await status(engine.updateFollowUp('f1', { status: 'Overdue', title: 'x' }, owner)), 'ok');
  assert.ok(writes.every((w) => w.status !== 'Overdue'), 'the computed label is never stored');
});

test('changing the assignee needs the reassign permission, leaving it alone does not', async () => {
  assert.equal(await status(engine.updateFollowUp('f1', { assignedTo: 'someone-else' }, owner)), 403);
  assert.equal(await status(engine.updateFollowUp('f1', { assignedTo: 'owner', title: 'x' }, owner)), 'ok');
  assert.equal(await status(engine.updateFollowUp('f1', { assignedTo: 'someone-else' }, manager)), 'ok');
});

test('a new date and time take effect even when the form also carries the old dueAt', async () => {
  await engine.updateFollowUp('f1', { date: '2099-12-01', time: '15:00', dueAt: stored.dueAt }, owner);
  assert.equal(writes[0].dueAt, '2099-12-01T09:30:00.000Z', '15:00 IST');
  writes.length = 0;
  await engine.updateFollowUp('f1', { time: '18:30' }, owner);
  assert.equal(writes[0].dueAt, '2099-06-10T13:00:00.000Z', 'a time alone keeps the day (18:30 IST on 10 June)');
});

test('snooze uses its minutes even when the form also sends a date, and a reschedule restarts escalation', async () => {
  const before = Date.now();
  await engine.rescheduleFollowUp('f1', { reason: 'busy', minutes: 10, date: '2099-01-01', time: '10:00' }, owner, 'snooze');
  const due = new Date(writes[0].dueAt).getTime();
  assert.ok(due >= before + 9 * 60000 && due <= Date.now() + 11 * 60000, 'about ten minutes from now, not 2099');
  assert.equal(writes[0].status, 'Snoozed');
  assert.equal(writes[0].escalationLevel, 0);
});

test('every outcome the complete dialog offers is accepted by the server', () => {
  // These are the four the dialog maps to (FollowUpModals.jsx actualOutcomeMap). "No Response" used to be rejected.
  for (const outcome of ['Connected', 'No Response', 'Busy', 'Switched Off']) {
    assert.ok(engine.OUTCOMES.includes(outcome), outcome);
  }
});
