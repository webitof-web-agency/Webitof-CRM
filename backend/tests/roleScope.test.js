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
