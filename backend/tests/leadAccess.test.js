// Who may see a lead: pipeline access plus either leads.view_all or working on the lead. No database.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canAccessLead,
  userHasUnrestrictedLeadAccess
} = require('../services/leadPipelineAccess.service');

const lead = (extra = {}) => ({ id: 'lead_1', pipelineId: 'pipe-default', assignedTo: 'other', ...extra });
const sales = (extra = {}) => ({ id: 'me', permissions: ['leads.read'], payload: {}, ...extra });

test('super admin sees every lead', () => {
  assert.equal(canAccessLead({ id: 'a', isSuperAdmin: true }, lead()), true);
  assert.equal(userHasUnrestrictedLeadAccess({ id: 'a', isSuperAdmin: true }), true);
});

test('leads.view_all sees leads assigned to others', () => {
  assert.equal(canAccessLead(sales({ permissions: ['leads.read', 'leads.view_all'] }), lead()), true);
});

test('without leads.view_all only leads the user works on are visible', () => {
  const user = sales();
  assert.equal(canAccessLead(user, lead()), false);
  assert.equal(canAccessLead(user, lead({ assignedTo: 'me' })), true);
  assert.equal(canAccessLead(user, lead({ leadOwner: 'me' })), true);
  assert.equal(canAccessLead(user, lead({ createdBy: 'me' })), true);
  assert.equal(canAccessLead(user, lead({ secondaryAssignees: ['x', 'me'] })), true);
  assert.equal(canAccessLead(user, lead({ secondaryAssignees: '["me"]' })), true);
  assert.equal(canAccessLead(user, lead({ managers: 'x, me' })), true);
  assert.equal(userHasUnrestrictedLeadAccess(user), false);
});

test('raw database rows (snake_case) are understood', () => {
  const row = { id: 'l', pipeline_id: 'pipe-default', assigned_to: 'other', lead_owner: 'me' };
  assert.equal(canAccessLead(sales(), row), true);
});

test('pipeline restriction still applies even with leads.view_all', () => {
  const user = sales({ permissions: ['leads.read', 'leads.view_all'], payload: { allowedLeadPipelineIds: ['pipe-a'] } });
  assert.equal(canAccessLead(user, lead({ pipelineId: 'pipe-b' })), false);
  assert.equal(canAccessLead(user, lead({ pipelineId: 'pipe-a' })), true);
  assert.equal(userHasUnrestrictedLeadAccess(user), false);
});

test('no user or no lead means no access', () => {
  assert.equal(canAccessLead(null, lead()), false);
  assert.equal(canAccessLead(sales(), null), false);
});
