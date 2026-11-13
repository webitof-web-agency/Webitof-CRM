// GET /dashboard/me against a real (disposable) database: the SQL of every section runs.
require('./helpers/requireTestDb');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { query, pool } = require('../config/db');
const { myDashboard } = require('../services/dashboard.service');

const tag = crypto.randomBytes(4).toString('hex');
const userId = `user_dash_${tag}`;
const otherId = `user_dash_other_${tag}`;
const leadIds = [];

async function insertUser(id) {
  await query(
    `insert into users(id, full_name, username, email, password_hash, is_active, payload)
     values ($1, 'Asha Verma', $1, $1 || '@example.test', 'x', true, '{}'::jsonb)`,
    [id]
  );
}

async function insertLead(fields) {
  const id = `lead_dash_${tag}_${leadIds.length}`;
  leadIds.push(id);
  await query(
    `insert into leads(id, name, company_name, status, lead_temperature, assigned_to, next_follow_up_time, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, coalesce($8::timestamptz, now()))`,
    [id, fields.name, fields.company || null, fields.status, fields.temperature || null, fields.assignedTo, fields.nextFollowUp || null, fields.createdAt || null]
  );
}

test.before(async () => {
  await insertUser(userId);
  await insertUser(otherId);
  await insertLead({ name: 'Hot one', company: 'Acme', status: 'Negotiation', temperature: 'Hot', assignedTo: userId });
  await insertLead({ name: 'Won one', status: 'Won', temperature: 'Hot', assignedTo: userId, nextFollowUp: '2026-01-01 10:00', createdAt: '2025-01-01T00:00:00Z' });
  await insertLead({ name: 'Old open', status: 'Contacted', assignedTo: userId, nextFollowUp: '2026-01-01 10:00', createdAt: '2025-01-01T00:00:00Z' });
  await insertLead({ name: 'Someone else', status: 'New', temperature: 'Hot', assignedTo: otherId });
  await query(
    `insert into notifications(id, recipient_type, user_id, module_name, event_key, title, message, is_read, created_at)
     values ($1, 'user', $2, 'leads', 'test', 'Lead assigned', 'Acme was assigned to you', false, now())`,
    [`notif_dash_${tag}`, userId]
  );
});

test.after(async () => {
  await query('delete from notifications where user_id = any($1::text[])', [[userId, otherId]]);
  await query('delete from leads where id = any($1::text[])', [leadIds]);
  await query('delete from users where id = any($1::text[])', [[userId, otherId]]);
  await pool.end();
});

test('every permitted section loads, and only the user\'s own leads are counted', async () => {
  const user = { id: userId, fullName: 'Asha Verma', permissions: ['leads.read', 'followups.view_own', 'calls.read'], hrmEmployeeId: null };
  const data = await myDashboard(user);

  for (const name of ['followUps', 'leads', 'notifications', 'performance']) {
    assert.ok(data[name] && !data[name].error, `${name} should load`);
  }
  assert.ok(Array.isArray(data.meetings), 'meetings should load');
  assert.equal(data.hrm, null, 'no HRM without an employee profile');
  assert.equal(data.tasks, null);

  assert.equal(data.leads.total, 3);
  assert.equal(data.leads.hot, 1, 'a won lead is not counted as hot');
  assert.equal(data.leads.newToday, 1);
  assert.equal(data.leads.noFollowUp, 1);
  assert.deepEqual(data.leads.items.map((lead) => lead.name), ['Hot one', 'Old open'], 'closed leads are left out, hot first');
  assert.equal(data.leads.byStatus.find((row) => row.status === 'Won').count, 1);

  assert.equal(data.notifications.unread, 1);
  assert.equal(data.notifications.items[0].title, 'Lead assigned');
  assert.equal(data.performance.leadsAssigned, 1);
  assert.equal(typeof data.performance.calls, 'number');
  assert.equal(data.user.name, 'Asha Verma');
});

test('sections the user has no permission for are not loaded', async () => {
  const data = await myDashboard({ id: userId, fullName: 'Asha Verma', permissions: [], hrmEmployeeId: null });
  assert.equal(data.leads, null);
  assert.equal(data.followUps, null);
  assert.equal(data.performance.leadsAssigned, undefined);
  assert.equal(data.performance.calls, undefined);
  assert.ok(data.notifications && !data.notifications.error, 'own notifications always load');
});
