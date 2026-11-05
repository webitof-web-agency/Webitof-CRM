// Approving a quotation converts the lead to a client and creates an invoice, so the first approval
// needs both leads.convert and invoices.write. Runs without a database (lead, settings and db are stubbed).
const test = require('node:test');
const assert = require('node:assert/strict');

const leadModel = require('../models/lead.model');
const settingsModel = require('../models/settings.model');
leadModel.findById = async (id) => ({ id, name: 'Lead', status: 'Qualified' });
settingsModel.getSettings = async () => ({ invoice: {}, gst: {} });

const { ensureInvoiceForApprovedQuotation } = require('../services/quotationInvoice.service');

const quotation = {
  id: 'evt_q1',
  eventType: 'quotation',
  leadId: 'lead_1',
  scopeId: 'lead_1',
  serviceNames: ['Website Development'],
  amount: 10000,
  discountType: 'percent',
  discountValue: 0,
  gstApplicable: true,
  gstRate: 18,
  status: 'Approved'
};
// No invoice exists yet for this quotation.
const db = { query: async () => ({ rows: [] }) };

async function approveAs(permissions, extra = {}) {
  try {
    await ensureInvoiceForApprovedQuotation({ event: quotation, req: { user: { id: 'u1', permissions, ...extra } }, db });
    return { status: 'allowed' };
  } catch (error) {
    return { status: error.statusCode || 500, message: error.message };
  }
}

test('approval is refused without leads.convert', async () => {
  const result = await approveAs(['leads.write', 'invoices.write']);
  assert.equal(result.status, 403);
  assert.match(result.message, /Convert Leads and Write Invoices/);
});

test('approval is refused without invoices.write', async () => {
  assert.equal((await approveAs(['leads.write', 'leads.convert'])).status, 403);
});

test('a plain lead editor cannot approve', async () => {
  assert.equal((await approveAs(['leads.read', 'leads.write'])).status, 403);
});

test('with both permissions the check passes (it proceeds past the permission gate)', async () => {
  const result = await approveAs(['leads.convert', 'invoices.write']);
  assert.notEqual(result.status, 403);
});

test('super admins pass the permission gate', async () => {
  assert.notEqual((await approveAs([], { isSuperAdmin: true })).status, 403);
});

test('a quotation that is not approved never needs the permissions', async () => {
  const draft = { ...quotation, status: 'Draft' };
  const result = await ensureInvoiceForApprovedQuotation({ event: draft, req: { user: { id: 'u1', permissions: [] } }, db });
  assert.equal(result.created, false);
});
