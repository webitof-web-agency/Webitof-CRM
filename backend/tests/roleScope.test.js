// Who sees whose clients, and which default roles see everyone's leads, calls and clients. No database.
const test = require('node:test');
const assert = require('node:assert/strict');
const { canAccessClient, filterClientsByAccess } = require('../services/clientAccess.service');
const { DEFAULT_ROLE_DEFINITIONS, PERMISSION_CODES } = require('../config/rbac');

const role = (code) => DEFAULT_ROLE_DEFINITIONS.find((item) => item.code === code);
const user = (permissions = ['clients.read'], extra = {}) => ({ id: 'me', permissions, ...extra });

test('without clients.view_all only assigned or managed clients are visible', () => {
  assert.equal(canAccessClient(user(), { assignedTo: 'other' }), false);
  assert.equal(canAccessClient(user(), { assignedTo: 'me' }), true);
  assert.equal(canAccessClient(user(), { assigned_to: 'me' }), true);
  assert.equal(canAccessClient(user(), { assignedTo: 'other', managers: 'x, me' }), true);
  assert.equal(canAccessClient(user(), { assignedTo: 'other', managers: '[{"id":"me"}]' }), true);
  assert.equal(canAccessClient(user(), { assignedTo: '' }), false);
});

test('clients.view_all and super admin see every client', () => {
  assert.equal(canAccessClient(user(['clients.read', 'clients.view_all']), { assignedTo: 'other' }), true);
  assert.equal(canAccessClient({ id: 'a', isSuperAdmin: true }, { assignedTo: 'other' }), true);
});

test('client list is filtered to the user own clients', () => {
  const rows = [{ id: 1, assignedTo: 'me' }, { id: 2, assignedTo: 'other' }, { id: 3, managers: 'me' }];
  assert.deepEqual(filterClientsByAccess(rows, user()).map((row) => row.id), [1, 3]);
  assert.equal(filterClientsByAccess(rows, user(['clients.view_all'])).length, 3);
});

test('sales sees only its own leads, calls, clients and follow-ups', () => {
  const perms = role('sales').permissions;
  ['leads.view_all', 'leads.assign', 'clients.view_all', 'calls.view_all', 'followups.view_team', 'followups.view_all']
    .forEach((code) => assert.equal(perms.includes(code), false, code));
});

test('accountant keeps every client for invoicing but only its own leads and calls', () => {
  const perms = role('accountant').permissions;
  assert.equal(perms.includes('clients.view_all'), true);
  assert.equal(perms.includes('leads.view_all'), false);
  assert.equal(perms.includes('calls.view_all'), false);
});

test('sales manager sees everyone in sales but cannot delete leads', () => {
  const perms = role('sales_manager').permissions;
  ['leads.view_all', 'leads.assign', 'clients.view_all', 'calls.view_all', 'followups.view_all', 'followups.bulk_assign']
    .forEach((code) => assert.equal(perms.includes(code), true, code));
  assert.equal(perms.includes('leads.delete'), false);
  assert.equal(perms.includes('users.manage'), false);
});

test('CTO has every permission and every HRM permission', () => {
  assert.deepEqual([...role('cto').permissions].sort(), [...PERMISSION_CODES].sort());
  assert.equal(role('cto').hrmPermissions, 'all');
});

// Super Admin records: hidden from everyone else, view_all included, unless they are on the record.
const { canAccessLead, userHasUnrestrictedLeadAccess } = require('../services/leadPipelineAccess.service');

const cto = (extra = {}) => ({
  id: 'cto',
  permissions: ['leads.read', 'leads.view_all', 'clients.read', 'clients.view_all'],
  payload: {},
  adminUserIds: ['admin1'],
  ...extra
});

test('a lead assigned to a Super Admin is hidden from view_all holders', () => {
  assert.equal(canAccessLead(cto(), { pipelineId: 'pipe-default', assignedTo: 'admin1' }), false);
  assert.equal(canAccessLead(cto(), { pipelineId: 'pipe-default', assignedTo: 'x', leadOwner: 'admin1' }), false);
  assert.equal(canAccessLead(cto(), { pipelineId: 'pipe-default', assignedTo: 'sales1', createdBy: 'admin1' }), true);
  assert.equal(userHasUnrestrictedLeadAccess(cto()), false);
});

test('someone on a Super Admin lead still sees it', () => {
  assert.equal(canAccessLead(cto(), { pipelineId: 'pipe-default', assignedTo: 'admin1', secondaryAssignees: ['cto'] }), true);
});

test('Super Admins see Super Admin leads and clients', () => {
  const admin = { id: 'admin2', isSuperAdmin: true, adminUserIds: [] };
  assert.equal(canAccessLead(admin, { pipelineId: 'pipe-default', assignedTo: 'admin1' }), true);
  assert.equal(canAccessClient(admin, { assignedTo: 'admin1' }), true);
});

test('a client assigned to a Super Admin is hidden from clients.view_all holders', () => {
  assert.equal(canAccessClient(cto(), { assignedTo: 'admin1' }), false);
  assert.equal(canAccessClient(cto(), { assignedTo: 'sales1' }), true);
  const rows = [{ id: 1, assignedTo: 'admin1' }, { id: 2, assignedTo: 'sales1' }, { id: 3, assignedTo: 'admin1', managers: 'cto' }];
  assert.deepEqual(filterClientsByAccess(rows, cto()).map((row) => row.id), [2, 3]);
});
