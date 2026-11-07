// Follow-up related-record search and the related-status write. No database: config/db is stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../config/db');
const calls = [];
db.query = async (sql, params = []) => {
  calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
  return { rows: [{ id: 'r1', label: 'Record', subtitle: '' }] };
};

const engine = require('../services/followUpEngine.service');
const controller = require('../controllers/followUps.controller');

function search(user, type, text = 'a') {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body });
      }
    };
    controller.searchRelated({ user, query: { type, search: text } }, res, reject);
  });
}
const user = (permissions, payload = {}) => ({ id: 'u1', permissions, payload });

test.beforeEach(() => {
  calls.length = 0;
});

test('creating follow-ups is not enough to search other modules\' records', async () => {
  const creator = user(['followups.create', 'followups.view_all']);
  for (const type of ['Lead', 'Client', 'Invoice', 'Payment', 'Project', 'Contact']) {
    assert.equal((await search(creator, type)).status, 403, type);
  }
  assert.equal(calls.length, 0, 'no query ran for a refused search');
});

test('read access to the matching module allows the search', async () => {
  assert.equal((await search(user(['leads.read']), 'Lead')).status, 200);
  assert.equal((await search(user(['invoices.read']), 'Invoice')).status, 200);
  assert.equal((await search(user(['clients.read']), 'Client')).status, 200);
  assert.equal((await search({ id: 'root', isSuperAdmin: true, permissions: [] }, 'Payment')).status, 200);
  assert.equal((await search(user(['leads.read']), 'Invoice')).status, 403, 'leads.read does not open invoices');
});

test('a user limited to some lead pipelines only searches those pipelines', async () => {
  await search(user(['leads.read'], { allowedLeadPipelineIds: ['pipe-a', 'pipe-b'] }), 'Lead');
  const restricted = calls[0];
  assert.match(restricted.sql, /pipeline_id/);
  assert.deepEqual(restricted.params[1], ['pipe-a', 'pipe-b']);
  calls.length = 0;
  await search(user(['leads.read']), 'Lead');
  assert.doesNotMatch(calls[0].sql, /pipeline_id/, 'an unrestricted user sees every pipeline');
});

test('contacts are searched in client contacts and need client access', async () => {
  assert.equal((await search(user(['leads.read']), 'Contact')).status, 403);
  await search(user(['clients.read']), 'Contact');
  assert.match(calls[0].sql, /from client_contacts/);
});

test('a type with no search definition returns nothing instead of falling back to leads', async () => {
  const result = await search(user(['leads.read']), 'Custom');
  assert.deepEqual(result.body.data, []);
  assert.equal(calls.length, 0);
  assert.deepEqual((await search(user(['leads.read']), 'Support ticket')).body.data, []);
});

test('completing a follow-up may only set the related status for records the user can edit', () => {
  const can = engine.canWriteRelatedStatus;
  assert.equal(can(user(['leads.write']), 'Lead', 'Won'), true);
  assert.equal(can(user(['leads.write']), 'Deal', 'Qualified'), true);
  assert.equal(can(user(['clients.write']), 'Client', 'Inactive'), true);
  assert.equal(can(user(['leads.read']), 'Lead', 'Won'), false, 'read-only cannot change a lead');
  assert.equal(can(user(['invoices.write']), 'Invoice', 'Paid'), false, 'invoice status is computed by finance');
  assert.equal(can(user(['payments.write']), 'Payment', 'Cleared'), false);
  assert.equal(can(user(['clients.write']), 'Contact', 'x'), false);
  assert.equal(can(user(['leads.write']), 'Lead', ''), false);
  assert.equal(can(user(['leads.write']), 'Lead', 'x'.repeat(61)), false);
  assert.equal(can({ id: 'root', isSuperAdmin: true, permissions: [] }, 'Project', 'Completed'), true);
});
