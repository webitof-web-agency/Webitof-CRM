const assert = require('node:assert/strict');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { closePool, query } = require('../config/db');

const baseUrl = process.env.TEST_API_URL || 'http://127.0.0.1:5000/api';

async function api(pathname, token) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const payload = await response.json();
  assert.equal(response.status, 200, `${pathname}: ${payload.message || response.statusText}`);
  assert.equal(payload.success, true, `${pathname} did not return success=true`);
  return payload;
}

async function run() {
  assert.ok(process.env.JWT_SECRET, 'JWT_SECRET must be configured');
  const userResult = await query(
    `select u.id from users u
     where u.is_active=true
       and exists (
         select 1 from user_roles ur join roles r on r.id=ur.role_id
         where ur.user_id=u.id and r.code='admin'
       )
     order by u.created_at asc limit 1`
  );
  assert.ok(userResult.rows[0]?.id, 'An active admin user is required for the smoke test');
  const token = jwt.sign({ sub: userResult.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '5m' });

  const options = await api('/follow-ups/options', token);
  assert.ok(options.data.followUpTypes.length >= 20);
  assert.ok(options.data.templates.length >= 14);

  const list = await api('/follow-ups?limit=5', token);
  assert.ok(Array.isArray(list.data));
  assert.equal(typeof list.meta.total, 'number');

  const today = await api('/follow-ups/today', token);
  assert.ok(today.data.counts && today.data.sections);

  const overdue = await api('/follow-ups/overdue?limit=5', token);
  assert.ok(Array.isArray(overdue.data));

  const attention = await api('/follow-ups/attention-required', token);
  assert.ok(attention.data.categories && attention.data.counts);

  const analytics = await api('/follow-ups/analytics', token);
  assert.equal(typeof analytics.data.total, 'number');
  assert.ok(analytics.data.byStatus && analytics.data.byAssignee);

  await api('/follow-up-templates', token);
  await api('/follow-up-sequences', token);
  await api('/follow-up-automation-rules', token);
  await api('/follow-up-escalation-rules', token);
  await api('/follow-ups/settings', token);

  console.log(JSON.stringify({ success: true, endpointsChecked: 11, customerMessagesSent: false }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => closePool());
