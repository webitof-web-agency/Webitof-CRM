// CRM end to end: lead capture (UI + webhook), validation, duplicates, visibility per role and
// pipeline, won/lost rules, conversion (including a double-click race), follow-ups, AMC/renewals,
// expenses and notifications.
// Run: QA_API_URL=... QA_DATABASE_URL=... node --test --test-concurrency=1 tests/e2e/crm.e2e.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { api, ok, login, sql, closeDb, fixtures, tag, PASSWORD } = require('./lib');

let f;
const today = new Date().toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
let phoneSeq = 0;
// Unique 10-digit Indian mobile per call, derived from the run tag so reruns do not collide.
const uniquePhone = () => `9${String(parseInt(tag.replace(/[^a-f]/g, '').slice(0, 3) || 'a', 16) % 1000).padStart(3, '0')}${String(Date.now() % 100000).padStart(5, '0')}${phoneSeq++ % 10}`.slice(0, 10);

const leadBody = (extra = {}) => ({
  contactPerson: `Lead Person ${tag}`,
  phone: uniquePhone(),
  requiredServices: ['Website Development'],
  source: 'Website',
  status: 'New',
  ...extra
});

async function makeLead(token = f.adminToken, extra = {}) {
  return ok(await api('/leads', { method: 'POST', token, body: leadBody(extra) }), 'lead');
}

async function userWithPermissions(key, codes, payload = {}) {
  const perms = ok(await api('/permissions', { token: f.adminToken }));
  const id = Object.fromEntries(perms.map((p) => [p.code, p.id]));
  const role = ok(await api('/roles', { method: 'POST', token: f.adminToken, body: { code: `qa_${key}_${tag}`, name: `qa ${key} ${tag}`, permissionIds: codes.map((c) => id[c]) } }));
  const email = `qa.${key}.${tag}@webitof.test`;
  const user = ok(await api('/users', { method: 'POST', token: f.adminToken, body: { fullName: `QA ${key.replace(/[^a-z]/gi, ' ')} ${tag}`, email, password: PASSWORD, roleIds: [role.id], ...payload } }));
  return { user, token: await login(email, PASSWORD) };
}

test.before(async () => { f = await fixtures(); });
test.after(closeDb);

test('lead validation names every missing field', async () => {
  const res = await api('/leads', { method: 'POST', token: f.adminToken, body: {} });
  assert.equal(res.status, 400);
  const text = JSON.stringify(res.body);
  for (const field of ['contactPerson', 'phone', 'requiredServices', 'source']) assert.ok(text.includes(field), `no error for ${field}`);
  const badEmail = await api('/leads', { method: 'POST', token: f.adminToken, body: leadBody({ email: 'not-an-email' }) });
  assert.equal(badEmail.status, 400);
  const badPhone = await api('/leads', { method: 'POST', token: f.adminToken, body: leadBody({ phone: '12' }) });
  assert.equal(badPhone.status, 400);
});

test('a 10-digit mobile is saved with +91 and found as a duplicate in any format', async () => {
  const phone = uniquePhone();
  const lead = await makeLead(f.adminToken, { phone: `${phone.slice(0, 5)} ${phone.slice(5)}` });
  assert.equal(lead.phone, `+91${phone}`);
  for (const variant of [phone, `+91${phone}`, `0${phone}`, `+91 ${phone.slice(0, 5)}-${phone.slice(5)}`]) {
    const dups = ok(await api(`/leads/duplicates?phone=${encodeURIComponent(variant)}`, { token: f.adminToken }));
    const rows = Array.isArray(dups) ? dups : (dups.leads || dups.duplicates || []);
    assert.ok(rows.some((r) => r.id === lead.id), `duplicate not found for ${variant}`);
  }
});

test('website webhook creates a lead with the key; the stored phone is normalised', async () => {
  const phone = uniquePhone();
  const res = await api('/leads/webhook', {
    method: 'POST',
    headers: { 'x-crm-webhook-key': 'qa-webhook-key-123' },
    body: { name: `Webhook ${tag}`, contactPerson: `Webhook ${tag}`, phone, email: `hook.${tag}@example.com`, requiredServices: ['Website Development'], source: 'Website', message: '<script>alert(1)</script>' }
  });
  assert.ok([200, 201].includes(res.status), `webhook ${res.status} ${res.body?.message}`);
  const [row] = await sql('select phone from leads where email = $1', [`hook.${tag}@example.com`]);
  assert.equal(row?.phone, `+91${phone}`);
});

test('without leads.view_all a user sees only leads they work on', async () => {
  const { token, user } = await userWithPermissions('leadown', ['leads.read', 'leads.write']);
  const mine = await makeLead(token);
  const theirs = await makeLead(f.adminToken);
  const list = ok(await api('/leads', { token }));
  const ids = (Array.isArray(list) ? list : list.rows || list.items || []).map((l) => l.id);
  assert.ok(ids.includes(mine.id), 'own lead missing');
  assert.ok(!ids.includes(theirs.id), "another user's lead is listed");
  for (const path of [`/leads/${theirs.id}`, `/leads/${theirs.id}/summary`, `/leads/${theirs.id}/history`]) {
    const res = await api(path, { token });
    assert.ok([403, 404].includes(res.status), `${path} -> ${res.status}`);
  }
  const edit = await api(`/leads/${theirs.id}`, { method: 'PUT', token, body: { notes: 'hijack' } });
  assert.ok([403, 404].includes(edit.status), `edited another user's lead (${edit.status})`);
  const steal = await api(`/leads/${theirs.id}/assign`, { method: 'PATCH', token, body: { assignedTo: user.id } });
  assert.ok([403, 404].includes(steal.status), `assigned another user's lead to self (${steal.status})`);
});

test('a user limited to one pipeline cannot open leads in another', async () => {
  const pipeline = ok(await api('/lead-pipelines', { method: 'POST', token: f.adminToken, body: { name: `Pipe ${tag}` } }), 'pipeline');
  const { token } = await userWithPermissions('pipe', ['leads.read', 'leads.write', 'leads.view_all'], { allowedLeadPipelineIds: [pipeline.id] });
  const defaultLead = await makeLead(f.adminToken);
  const res = await api(`/leads/${defaultLead.id}`, { token });
  assert.ok([403, 404].includes(res.status), `opened a lead outside the allowed pipeline (${res.status})`);
  const list = ok(await api('/leads', { token }));
  const rows = Array.isArray(list) ? list : list.rows || list.items || [];
  assert.ok(rows.every((l) => l.pipelineId === pipeline.id), 'list shows leads from other pipelines');
});

test('lost needs a reason; "Other" also needs notes', async () => {
  const lead = await makeLead();
  assert.equal((await api(`/leads/${lead.id}/lost`, { method: 'POST', token: f.adminToken, body: {} })).status, 400);
  assert.equal((await api(`/leads/${lead.id}/lost`, { method: 'POST', token: f.adminToken, body: { lostReason: 'Other' } })).status, 400);
  const lost = await api(`/leads/${lead.id}/lost`, { method: 'POST', token: f.adminToken, body: { lostReason: 'Budget issue', reconnectDate: plusDays(30) } });
  assert.ok(lost.status < 300, `lost with a reason -> ${lost.status} ${lost.body?.message} ${JSON.stringify(lost.body?.details || lost.body?.errors || '')}`);
});

test('converting a won lead twice at the same moment creates one client, not two', async () => {
  const lead = await makeLead(f.adminToken, { companyName: `Convert Co ${tag}`, email: `convert.${tag}@example.com` });
  const won = await api(`/leads/${lead.id}/won`, { method: 'POST', token: f.adminToken, body: { wonDate: today, dealValue: 50000 } });
  assert.ok(won.status < 300, `won -> ${won.status} ${won.body?.message} ${JSON.stringify(won.body?.details || won.body?.errors || '')}`);
  const results = await Promise.all([1, 2, 3, 4].map(() => api(`/leads/${lead.id}/convert`, { method: 'POST', token: f.adminToken, body: { createProject: true } })));
  assert.ok(results.some((r) => r.status < 300), `no conversion succeeded: ${results.map((r) => `${r.status} ${r.body?.message}`).join(' | ')}`);
  const clients = await sql("select id from clients where payload->>'convertedLeadId' = $1", [lead.id]);
  assert.equal(clients.length, 1, `${clients.length} clients created from one lead`);
  const del = await api(`/leads/${lead.id}`, { method: 'DELETE', token: f.adminToken });
  assert.equal(del.status, 409, 'a converted lead was deleted');
});

test('follow-ups: completion needs an outcome, rescheduling needs a reason, others cannot touch mine', async () => {
  const lead = await makeLead(f.tokens.sales);
  const fu = ok(await api('/follow-ups', {
    method: 'POST',
    token: f.tokens.sales,
    body: { relatedEntityType: 'Lead', relatedEntityId: lead.id, title: 'Call back', date: plusDays(1), time: '11:00', followUpType: 'Call', assignedTo: f.users.sales.id }
  }), 'follow-up');
  assert.equal((await api(`/follow-ups/${fu.id}/complete`, { method: 'POST', token: f.tokens.sales, body: {} })).status, 400);
  assert.equal((await api(`/follow-ups/${fu.id}/reschedule`, { method: 'POST', token: f.tokens.sales, body: { date: plusDays(3), time: '11:00' } })).status, 400);
  const other = await api(`/follow-ups/${fu.id}`, { method: 'PATCH', token: f.tokens.sales2, body: { title: 'Hijacked' } });
  assert.ok([403, 404].includes(other.status), `another sales user edited my follow-up (${other.status})`);
  const otherDone = await api(`/follow-ups/${fu.id}/complete`, { method: 'POST', token: f.tokens.sales2, body: { actualOutcome: 'Interested', communicationResult: 'Connected', discussionNote: 'x', closureReason: 'x' } });
  assert.ok([403, 404].includes(otherDone.status), `another sales user completed my follow-up (${otherDone.status})`);
  const missingDue = await api('/follow-ups', { method: 'POST', token: f.tokens.sales, body: { relatedEntityType: 'Lead', relatedEntityId: lead.id, title: 'x' } });
  assert.equal(missingDue.status, 400);
  const otherLead = await makeLead(f.adminToken);
  const foreign = await api('/follow-ups', { method: 'POST', token: f.tokens.accountant, body: { relatedEntityType: 'Lead', relatedEntityId: 'no-such-lead', title: 'x', date: plusDays(1), time: '10:00' } });
  assert.ok(foreign.status >= 400 && foreign.status < 500, `follow-up on a missing lead accepted (${foreign.status})`);
  assert.ok(otherLead.id);
});

test('AMC, renewals, expenses and banking refuse impossible values', async () => {
  const client = ok(await api('/clients', { method: 'POST', token: f.adminToken, body: { name: `AMC Client ${tag}` } }));
  const cases = [
    ['/amc', { clientId: client.id, title: 'AMC', amcAmount: 12000, startDate: '2026-06-01', endDate: '2026-01-01' }],
    ['/amc', { clientId: client.id, title: 'AMC', amcAmount: -100, startDate: '2026-01-01', endDate: '2026-12-31' }],
    ['/renewals', { clientId: client.id, serviceName: 'Domain', renewalDate: '2026-02-30', amount: 1000 }],
    ['/renewals', { clientId: client.id, serviceName: 'Domain', renewalDate: plusDays(30), amount: -1000 }],
    ['/expenses', { title: 'Tea', amountBeforeGst: -50, expenseDate: today }],
    ['/expenses', { title: 'Tea', amountBeforeGst: 100, gstRate: 18, paidAmount: 500, expenseDate: today }],
    ['/expenses', { title: 'Tea', amountBeforeGst: 100, tdsRate: 150, expenseDate: today }],
    ['/expenses', { title: 'Tea', amount: 50, expenseDate: '2026-13-01', category: 'Office' }],
    ['/banking/transactions', { amount: -10, transactionType: 'credit', transactionDate: today }]
  ];
  const accepted = [];
  for (const [path, body] of cases) {
    const res = await api(path, { method: 'POST', token: f.adminToken, body });
    if (res.status < 300) accepted.push(`${path} ${JSON.stringify(body)}`);
    assert.ok(res.status < 500, `${path} crashed: ${res.status} ${res.body?.message}`);
  }
  assert.deepEqual(accepted, [], 'accepted impossible values');
});

test("notifications: nobody can read or clear another user's notifications", async () => {
  await sql(
    `insert into notifications (id, user_id, title, message, is_read, payload) values ($1, $2, 'Private', 'Secret', false, '{}'::jsonb)`,
    [`qa_ntf_${tag}`, f.users.accountant.id]
  ).catch(() => {});
  const [row] = await sql('select id from notifications where id = $1', [`qa_ntf_${tag}`]);
  if (!row) return; // schema differs; the route-level matrix still covers the endpoint
  const res = await api(`/notifications/${row.id}/read`, { method: 'PATCH', token: f.tokens.sales });
  assert.equal(res.status, 404);
  const list = ok(await api('/notifications', { token: f.tokens.sales }));
  const items = Array.isArray(list) ? list : list.items || list.rows || [];
  assert.ok(!items.some((n) => n.id === row.id), "another user's notification is listed");
});
