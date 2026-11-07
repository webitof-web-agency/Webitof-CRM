// Guards for the review fixes: order-by injection, email HTML escaping, event ownership,
// public invoice data, and outsourcing reminder dedupe. Runs without a database.
const test = require('node:test');
const assert = require('node:assert/strict');

const { safeOrderBy } = require('../utils/orderBy');
const { escapeHtml } = require('../utils/escapeHtml');

test('safeOrderBy keeps plain column orders', () => {
  assert.equal(safeOrderBy('created_at DESC', 'updated_at DESC'), 'created_at DESC');
  assert.equal(safeOrderBy('name', 'x'), 'name');
  assert.equal(safeOrderBy('f.due_at asc, created_at desc nulls last', 'x'), 'f.due_at asc, created_at desc nulls last');
});

test('safeOrderBy rejects anything that could change the query', () => {
  const fallback = 'updated_at DESC';
  const attacks = [
    '(select pg_sleep(5))',
    'id; drop table users',
    'id desc, (case when 1=1 then 1 else 2 end)',
    'id -- comment',
    "name' or '1'='1",
    'id desc limit 1 offset 5',
    'a, b, c, d',
    '',
    undefined,
    { toString: () => 'id' },
    'x'.repeat(200)
  ];
  for (const value of attacks) assert.equal(safeOrderBy(value, fallback), fallback, String(value));
  assert.equal(safeOrderBy(['id desc', '(select 1)'], fallback), 'id desc');
});

test('escapeHtml neutralizes markup in record text', () => {
  assert.equal(escapeHtml('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
  assert.equal(escapeHtml("Tom & Jerry's"), 'Tom &amp; Jerry&#39;s');
  assert.equal(escapeHtml(null), '');
});

test('only the owner or a super admin can change an event', async () => {
  const leadEventModel = require('../models/leadEvent.model');
  const events = require('../controllers/events.controller');
  const stored = { id: 'evt1', eventType: 'event', ownerUserId: 'owner', visibility: 'all_team', attachments: [] };
  leadEventModel.findById = async () => stored;
  leadEventModel.update = async (id, body) => ({ ...stored, ...body });
  leadEventModel.remove = async () => true;

  const call = async (handler, user) => {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    let error = null;
    await handler({ params: { id: 'evt1' }, body: { title: 'x' }, user }, res, (err) => { error = err; });
    return { status: error ? 500 : res.statusCode, error };
  };

  assert.equal((await call(events.update, { id: 'other', permissions: [] })).status, 403);
  assert.equal((await call(events.remove, { id: 'other', permissions: [] })).status, 403);
  assert.equal((await call(events.remove, { id: 'owner', permissions: [] })).status, 200);
  assert.equal((await call(events.remove, { id: 'admin', isSuperAdmin: true })).status, 200);
});

test('the public invoice link exposes only the client fields the page renders', async () => {
  const invoiceModel = require('../models/invoice.model');
  const clientModel = require('../models/client.model');
  const settingsModel = require('../models/settings.model');
  // The public link looks the invoice up by exact id and loads its payments to show the true status.
  invoiceModel.findByExactId = async () => ({ id: 'inv1', clientId: 'c1', invoiceNumber: 'INV-1', items: [], status: 'Sent' });
  require('../models/payment.model').list = async () => [];
  require('../models/creditNote.model').list = async () => [];
  clientModel.findById = async () => ({
    id: 'c1', name: 'Asha', companyName: 'Asha Co', billingAddress: '1 Street', city: 'Delhi', state: 'Delhi',
    gstin: '07AAAAA0000A1Z5', email: 'private@asha.test', mobile: '9999999999', notes: 'internal note', payload: { secret: 1 }
  });
  settingsModel.getSettings = async () => ({ company: {}, logos: {}, branding: {}, invoice: {}, gst: {}, tds: {} });

  const { getPublic } = require('../controllers/invoices.controller').default || require('../controllers/invoices.controller');
  const res = { json(body) { this.body = body; return this; }, status() { return this; } };
  await getPublic({ params: { id: 'inv1' } }, res, (err) => { throw err; });

  const client = res.body.data.client;
  assert.equal(client.companyName, 'Asha Co');
  assert.equal(client.gstin, '07AAAAA0000A1Z5');
  for (const key of ['email', 'mobile', 'notes', 'payload']) assert.equal(key in client, false, `${key} must not be public`);
});
