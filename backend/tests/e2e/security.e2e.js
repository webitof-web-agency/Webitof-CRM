// Security checks over real HTTP: tokens, account takeover paths, mass assignment, cross-user
// access (IDOR) and how the API copes with hostile input.
// Run: QA_API_URL=... QA_DATABASE_URL=... QA_JWT_SECRET=<the QA backend's JWT_SECRET> node --test tests/e2e/security.e2e.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { api, ok, login, sql, closeDb, fixtures, hrmFixtures, forgeToken, PASSWORD, tag } = require('./lib');

const SECRET = process.env.QA_JWT_SECRET || '';
let f;
let lead;

test.before(async () => {
  f = await fixtures();
  lead = ok(await api('/leads', {
    method: 'POST',
    token: f.adminToken,
    body: { contactPerson: 'Security Probe', phone: '+919811100001', requiredServices: ['Website Development'], source: 'Website', status: 'New' }
  }), 'lead');
});
test.after(closeDb);

test('tokens: forged, alg none, expired, purpose-bound and garbage tokens are all refused', async () => {
  const sub = f.users.sales.id;
  const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.`;
  const tokens = [forgeToken({ sub }), unsigned, 'Bearer', 'x.y.z', `${f.tokens.sales}x`];
  if (SECRET) {
    tokens.push(forgeToken({ sub, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET));
    tokens.push(forgeToken({ sub, purpose: 'drive-oauth' }, SECRET));
    tokens.push(forgeToken({ sub: 'user_does_not_exist' }, SECRET));
  }
  for (const token of tokens) {
    const res = await api('/auth/me', { token });
    assert.equal(res.status, 401, `token ${token.slice(0, 40)} gave ${res.status}`);
  }
});

test('a deactivated user loses access on the next request and cannot log in again', async () => {
  const email = `qa.deact.${tag}@webitof.test`;
  const user = ok(await api('/users', { method: 'POST', token: f.adminToken, body: { fullName: 'QA Deactivated', email, password: PASSWORD, roleIds: [f.roles.sales.id] } }));
  const token = await login(email, PASSWORD);
  assert.equal((await api('/auth/me', { token })).status, 200);
  ok(await api(`/users/${user.id}`, { method: 'PUT', token: f.adminToken, body: { isActive: false } }), 'deactivate');
  assert.equal((await api('/leads', { token })).status, 401);
  const relog = await api('/auth/login', { method: 'POST', body: { identifier: email, password: PASSWORD } });
  assert.ok([401, 403].includes(relog.status), `inactive login gave ${relog.status}`);
});

test('login does not reveal whether an account exists', async () => {
  const unknown = await api('/auth/login', { method: 'POST', body: { identifier: `nobody.${tag}@webitof.test`, password: 'Wrong@12345' } });
  const wrong = await api('/auth/login', { method: 'POST', body: { identifier: f.users.sales2.email, password: 'Wrong@12345' } });
  assert.equal(unknown.status, wrong.status);
  assert.equal(unknown.body?.message, wrong.body?.message);
  const forgotUnknown = await api('/auth/forgot-password', { method: 'POST', body: { email: `nobody2.${tag}@webitof.test` } });
  const forgotKnown = await api('/auth/forgot-password', { method: 'POST', body: { email: f.users.sales2.email } });
  // SMTP is blank on the QA stack, so a known address may fail to send; it must not answer differently in a way that names the account.
  assert.equal(forgotUnknown.status === 404, false, 'forgot-password answers 404 for an unknown account');
  assert.ok(forgotKnown.status < 500 || !/user|account/i.test(forgotKnown.body?.message || ''), 'forgot-password error names the account');
});

test('repeated bad logins are rate limited', async () => {
  const identifier = `rate.${tag}@webitof.test`;
  let last;
  for (let i = 0; i < 12; i += 1) {
    last = await api('/auth/login', { method: 'POST', body: { identifier, password: `Bad@${i}xxxxx` } });
  }
  assert.equal(last.status, 429);
  assert.ok(last.headers.get('retry-after'));
});

test('profile update cannot change roles, status, salary, pipelines or the login email of the account', async () => {
  const before = ok(await api('/auth/me', { token: f.tokens.sales }));
  await api('/auth/profile', {
    method: 'PATCH',
    token: f.tokens.sales,
    body: {
      roleIds: [f.roles.admin.id],
      roles: [{ code: 'admin' }],
      isSuperAdmin: true,
      isActive: false,
      salary: 999999,
      permissions: ['users.manage'],
      allowedLeadPipelineIds: ['*'],
      payload: { allowedLeadPipelineIds: ['*'], hrmBlocked: null },
      email: f.users.admin.email,
      username: 'qa.admin'
    }
  });
  const after = ok(await api('/auth/me', { token: f.tokens.sales }));
  assert.equal(after.isSuperAdmin, false);
  assert.deepEqual(after.roles.map((r) => r.code).sort(), before.roles.map((r) => r.code).sort());
  assert.deepEqual(after.permissions.sort(), before.permissions.sort());
  assert.equal(Number(after.salary || 0), Number(before.salary || 0));
  assert.notEqual(after.email, f.users.admin.email);
  assert.notEqual(after.username, 'qa.admin');
  assert.deepEqual(after.allowedLeadPipelineIds, before.allowedLeadPipelineIds);
});

test('users.manage / roles.manage alone cannot reach Super Admin', async () => {
  const t = f.tokens.usermgr;
  const adminRole = f.roles.admin.id;
  const ownRole = f.roles.qa_usermgr.id;
  const attempts = [
    ['POST', '/users', { fullName: 'QA Escalate', email: `qa.esc.${tag}@webitof.test`, password: PASSWORD, roleIds: [adminRole] }],
    ['PUT', `/users/${f.users.admin.id}`, { password: 'Takeover@12345' }],
    ['PUT', `/users/${f.users.admin.id}`, { isActive: false }],
    ['DELETE', `/users/${f.users.admin.id}`],
    ['PUT', `/users/${f.users.usermgr.id}`, { roleIds: [ownRole, adminRole] }],
    ['PUT', `/roles/${ownRole}`, { code: 'admin' }],
    ['PUT', `/roles/${ownRole}`, { code: ' ADMIN ' }],
    ['PUT', `/roles/${ownRole}`, { name: 'admin', code: 'Admin' }],
    ['POST', '/roles', { name: 'Admin' }],
    ['POST', '/roles', { code: 'admin', name: 'Shadow' }],
    ['PUT', `/roles/${adminRole}`, { permissionIds: [] }],
    ['PUT', `/roles/${adminRole}`, { isActive: false }],
    ['DELETE', `/roles/${adminRole}`]
  ];
  for (const [method, path, body] of attempts) {
    const res = await api(path, { method, token: t, body });
    assert.ok([400, 403, 409].includes(res.status), `${method} ${path} ${JSON.stringify(body || {})} gave ${res.status} ${res.body?.message}`);
  }
  const me = ok(await api('/auth/me', { token: t }));
  assert.equal(me.isSuperAdmin, false);
  const adminStill = ok(await api('/auth/me', { token: f.adminToken }));
  assert.equal(adminStill.isSuperAdmin, true);
});

test('the last Super Admin cannot delete or deactivate itself', async () => {
  for (const [method, body] of [['DELETE'], ['PUT', { isActive: false }], ['PUT', { roleIds: [f.roles.sales.id] }]]) {
    const res = await api(`/users/${f.users.admin.id}`, { method, token: f.adminToken, body });
    assert.ok(res.status >= 400 && res.status < 500, `${method} self gave ${res.status}`);
  }
  assert.equal((await api('/auth/me', { token: f.adminToken })).body.data.isSuperAdmin, true);
});

test('even a Super Admin cannot delete, rename or switch off the admin role', async () => {
  const adminRole = f.roles.admin.id;
  for (const [method, body] of [['DELETE'], ['PUT', { code: 'owner' }], ['PUT', { isActive: false }]]) {
    const res = await api(`/roles/${adminRole}`, { method, token: f.adminToken, body });
    assert.equal(res.status, 409, `${method} admin role ${JSON.stringify(body || {})} gave ${res.status}`);
  }
  assert.equal((await api('/auth/me', { token: f.adminToken })).body.data.isSuperAdmin, true);
});

test('events: the owner is always the caller and only "event" records are written', async () => {
  const created = ok(await api('/events', {
    method: 'POST',
    token: f.tokens.zero,
    body: { title: 'Spoofed', ownerUserId: f.users.admin.id, visibility: 'all_team' }
  }), 'event');
  assert.equal(created.ownerUserId, f.users.zero.id, 'ownerUserId taken from the body');

  const injected = await api('/events', {
    method: 'POST',
    token: f.tokens.zero,
    body: { title: 'Injected note', eventType: 'note', scopeType: 'lead', scopeId: lead.id, leadId: lead.id }
  });
  const rows = await sql("select event_type from lead_events where lead_id = $1 and title = 'Injected note'", [lead.id]);
  assert.equal(rows.filter((r) => r.event_type !== 'event').length, 0, `a non-event record was written to the lead timeline (status ${injected.status})`);

  const update = await api(`/events/${created.id}`, { method: 'PUT', token: f.tokens.zero, body: { eventType: 'call', ownerUserId: f.users.admin.id } });
  const [row] = await sql('select event_type, owner_user_id from lead_events where id = $1', [created.id]);
  assert.equal(row.event_type, 'event', `update changed the event type (status ${update.status})`);
  assert.equal(row.owner_user_id, f.users.zero.id, 'update moved ownership');
});

test('events linked to a lead, client or project need read access to that record', async () => {
  const res = await api('/events', {
    method: 'POST',
    token: f.tokens.zero,
    body: { title: 'On a lead I cannot see', scopeType: 'lead', scopeId: lead.id }
  });
  assert.equal(res.status, 403, `zero-permission user linked an event to a lead (${res.status})`);

  ok(await api('/events', { method: 'POST', token: f.adminToken, body: { title: 'Lead meeting', scopeType: 'lead', scopeId: lead.id, visibility: 'all_team' } }));
  const listed = ok(await api(`/events?scopeType=lead&scopeId=${lead.id}`, { token: f.tokens.zero }));
  assert.equal(listed.length, 0, 'a user without leads.read lists events of a lead');
});

test("events: attachments of another user's event cannot be pulled into your own", async () => {
  const theirs = ok(await api('/events', { method: 'POST', token: f.adminToken, body: { title: 'Board pack', visibility: 'all_team' } }));
  const fileId = `qa_file_${tag}`;
  await sql(
    `insert into file_assets (id, file_key, module_name, entity_id, original_name, stored_name, mime_type, size_bytes, storage_provider)
     values ($1, $1, 'events', $2, 'board.pdf', 'board.pdf', 'application/pdf', 3, 'local')`,
    [fileId, theirs.id]
  );
  await api('/events', { method: 'POST', token: f.tokens.zero, body: { title: 'Mine', attachmentEntityId: theirs.id } });
  const [row] = await sql('select entity_id from file_assets where id = $1', [fileId]);
  assert.equal(row.entity_id, theirs.id, "another event's attachment was rebound to the attacker's event");
});

test('global search returns nothing a user may not read', async () => {
  ok(await api('/clients', { method: 'POST', token: f.adminToken, body: { name: `Searchable ${tag}`, companyName: `Searchable ${tag}`, mobile: '+919811100002' } }));
  const res = ok(await api(`/leads/search/global?q=Searchable&search=Searchable`, { token: f.tokens.zero }));
  const total = Object.values(res || {}).reduce((sum, v) => sum + (Array.isArray(v) ? v.length : 0), 0);
  assert.equal(total, 0, `zero-permission global search returned ${JSON.stringify(res).slice(0, 200)}`);
});

test('the user lookup exposes only display fields', async () => {
  const rows = ok(await api('/users/lookup', { token: f.tokens.zero }));
  const forbidden = ['passwordHash', 'password_hash', 'salary', 'payload', 'permissions', 'address'];
  for (const row of rows) {
    for (const key of forbidden) assert.ok(!(key in row), `lookup leaks ${key}`);
  }
});

test('hostile input gets a 4xx, never a crash or a leak', async () => {
  const t = f.adminToken;
  const big = 'x'.repeat(3 * 1024 * 1024);
  const cases = [
    ['POST', '/leads', `{"contactPerson": "${big}"}`],
    ['POST', '/leads', '{"broken json'],
    ['GET', "/leads/' OR '1'='1"],
    ['GET', '/clients?orderBy=no_such_column'],
    ['GET', '/clients?orderBy=id;drop table users'],
    ['GET', '/clients?created_at=not-a-date'],
    ['GET', '/invoices?limit=-5&offset=abc'],
    ['POST', '/payments', { amountReceived: 'NaN', invoiceId: "'; select 1;--" }],
    ['POST', '/expenses', { amount: 1e308, expenseDate: '2026-02-30' }],
    ['GET', '/reports/profit-loss?from=2026-13-01'],
    ['GET', '/reports/profit-loss?fy=2026-99'],
    ['PUT', '/clients/%00', {}],
    ['GET', '/files/..%2f..%2f.env/view']
  ];
  for (const [method, path, body] of cases) {
    const res = await api(path, { method, token: t, body, headers: typeof body === 'string' ? { 'Content-Type': 'application/json' } : {} });
    assert.ok(res.status < 500, `${method} ${path} -> ${res.status} ${res.text.slice(0, 160)}`);
    assert.ok(!/select |insert |update |relation "|column "|violates/i.test(res.body?.message || ''), `${method} ${path} leaks SQL: ${res.body?.message}`);
  }
});

test('security headers are set', async () => {
  const res = await api('/health');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('x-frame-options') || /frame-ancestors/.test(res.headers.get('content-security-policy') || ''));
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('lead webhook: needs the key, rejects a wrong one', async () => {
  const body = { contactPerson: 'Webhook Lead', phone: '9811100003', requiredServices: ['Website Development'], source: 'Website' };
  assert.equal((await api('/leads/webhook', { method: 'POST', body })).status, 401);
  assert.equal((await api('/leads/webhook', { method: 'POST', body, headers: { 'x-crm-webhook-key': 'webitof-crm-webhook-secret' } })).status, 401, 'the old public default key still works');
  assert.equal((await api('/leads/webhook?key=wrong', { method: 'POST', body })).status, 401);
});

test('lead webhook: a flood from one IP is throttled (run this suite after crm.e2e.js)', async () => {
  const statuses = await Promise.all(Array.from({ length: 45 }, () => api('/leads/webhook', { method: 'POST', body: {} }).then((r) => r.status)));
  assert.ok(statuses.includes(429), `45 webhook posts in a burst, none throttled: ${[...new Set(statuses)].join(',')}`);
});

// ---- HRM: what the guard lets through, the services must still scope -------------------------

test('HRM: an employee sees only their own records', async () => {
  const h = await hrmFixtures();
  const t = f.tokens.employee; // employee A
  const denied = [
    ['GET', `/hrm/employees/${h.b.id}`],
    ['GET', `/hrm/employees/${h.b.id}/private`],
    ['GET', `/hrm/employees/${h.b.id}/leave-balances`],
    ['GET', `/hrm/employees/${h.b.id}/summary`],
    ['PUT', `/hrm/employees/${h.a.id}`, { fullName: 'Self Promoted', status: 'Active', managerId: null }],
    ['PUT', '/hrm/policy', { slotMinutes: 5 }],
    ['POST', '/hrm/automation/run', {}],
    ['POST', '/hrm/attendance/override', { employeeId: h.a.id, date: h.today, status: 'Present' }],
    ['POST', '/hrm/attendance/mark', { employeeId: h.a.id, date: h.today, status: 'Present' }],
    ['POST', '/hrm/holidays', { name: 'Free day', date: h.today }],
    ['POST', '/hrm/leave-grants', { employeeId: h.a.id, days: 30 }],
    ['POST', '/hrm/salary-history', { employeeId: h.a.id, amount: 999999 }],
    ['POST', '/hrm/payroll', { month: h.today.slice(0, 7) }],
    ['GET', '/hrm/export/employees'],
    ['POST', '/hrm/geofences', { name: 'Home', lat: 0, lng: 0, radius: 100000 }],
    ['PUT', '/hrm/work-reports/admin', {}]
  ];
  const leaks = [];
  for (const [method, path, body] of denied) {
    const res = await api(path, { method, token: t, body });
    if (res.status < 400 || res.status >= 500) leaks.push(`${method} ${path} -> ${res.status} ${res.body?.message || ''}`);
  }
  assert.deepEqual(leaks, []);

  const list = ok(await api('/hrm/employees', { token: t }));
  const rows = Array.isArray(list) ? list : (list.rows || list.items || []);
  assert.ok(rows.every((e) => e.id === h.a.id), `employee list shows ${rows.map((e) => e.fullName).join(', ')}`);
});

test("HRM: a manager sees the team member but not someone else's report", async () => {
  const h = await hrmFixtures();
  const t = f.tokens.hrm_manager;
  assert.equal((await api(`/hrm/employees/${h.a.id}`, { token: t })).status, 200);
  const other = await api(`/hrm/employees/${h.b.id}`, { token: t });
  assert.ok([403, 404].includes(other.status), `manager opened an employee outside the team (${other.status})`);
  const priv = await api(`/hrm/employees/${h.a.id}/private`, { token: t });
  assert.ok([403, 404].includes(priv.status), `manager without view_private opened private profile (${priv.status})`);
});
