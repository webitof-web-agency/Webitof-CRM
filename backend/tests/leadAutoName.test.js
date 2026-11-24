// "Unknown" lead names come from the lead number: LD-2026-000012 -> Lead-000012. No database.
const test = require('node:test');
const assert = require('node:assert/strict');
const { autoLeadName, applyUnknownNames } = require('../controllers/leads.controller');

test('the auto name keeps the number part of the lead number', () => {
  assert.equal(autoLeadName('LD-2026-000012'), 'Lead-000012');
  assert.equal(autoLeadName(''), '');
});

test('unknown business name fills company and name', () => {
  const out = applyUnknownNames({ type: 'Organization', companyName: '', nameUnknown: true, contactPerson: 'Ravi' }, 'LD-2026-000012');
  assert.equal(out.companyName, 'Lead-000012');
  assert.equal(out.name, 'Lead-000012');
  assert.equal(out.contactPerson, 'Ravi');
});

test('unknown person name and contact both get the auto name', () => {
  const out = applyUnknownNames({ type: 'Person', name: '', nameUnknown: 'true', contactPersonUnknown: true }, 'LD-2026-000007');
  assert.equal(out.name, 'Lead-000007');
  assert.equal(out.contactPerson, 'Lead-000007');
  assert.equal(out.companyName, undefined);
});

test('without the flags nothing changes', () => {
  const body = { type: 'Organization', companyName: 'Acme', contactPerson: 'Ravi' };
  assert.deepEqual(applyUnknownNames(body, 'LD-2026-000012'), body);
});
