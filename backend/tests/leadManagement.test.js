const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLeadScore } = require('../config/leadManagement');
const { validateLeadPayload } = require('../services/leadValidation.service');

function validLead(overrides = {}) {
  return {
    contactPerson: 'Aarav Sharma',
    phone: '+919810000001',
    email: 'aarav@example.com',
    requiredServices: ['CRM Development'],
    source: 'Website',
    status: 'New',
    assignedTo: 'user-sales',
    ...overrides
  };
}

test('lead score follows the configured 100 point BANT-style rules', () => {
  const score = calculateLeadScore(validLead({
    whatsappNumber: '+919810000001',
    requirementConfirmed: 'Yes',
    budgetConfirmed: 'Yes',
    decisionMakerIdentified: 'Yes',
    timelineConfirmed: 'Yes',
    followUpDate: '2026-08-01'
  }));
  assert.equal(score, 100);
});

test('minimal enriched lead payload is valid', () => {
  const result = validateLeadPayload(validLead(), { isCreate: true });
  assert.equal(result.isValid, true);
  assert.deepEqual(result.normalized.requiredServices, ['CRM Development']);
});

test('new lead with other service requires service details', () => {
  const result = validateLeadPayload(validLead({ requiredServices: ['Other'] }), { isCreate: true });
  assert.equal(result.isValid, false);
  assert.equal(result.errors.otherServiceDetails, 'Describe the other required service');
});

test('new lead requires contact, phone, service, source and status', () => {
  const result = validateLeadPayload({}, { isCreate: true });
  assert.equal(result.isValid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['contactPerson', 'phone', 'requiredServices', 'source', 'status']);
});

test('legacy lead can be edited without backfilling all new mandatory fields', () => {
  const result = validateLeadPayload({ status: 'Lost', source: 'Referral' }, { legacyRecord: true });
  assert.equal(result.isValid, true);
});

test('legacy status update is not blocked by missing other service details', () => {
  const result = validateLeadPayload({ status: 'Won', requiredServices: ['Other'] }, { legacyRecord: true });
  assert.equal(result.isValid, true);
});

test('legacy compatibility can still enforce conditional fields on explicit transitions', () => {
  const lost = validateLeadPayload({ status: 'Lost' }, { legacyRecord: true, enforceLostFields: true });
  assert.equal(lost.isValid, false);
  assert.equal(lost.errors.lostReason, 'Lost reason is required');

  const referral = validateLeadPayload({ source: 'Referral' }, { legacyRecord: true, enforceReferralFields: true });
  assert.equal(referral.isValid, false);
  assert.equal(referral.errors.referrerName, 'Referrer name is required');
});

test('lost lead requires reason and reconnect date', () => {
  const result = validateLeadPayload(validLead({
    status: 'Lost',
    reconnectInFuture: true
  }), { isCreate: true });
  assert.equal(result.errors.lostReason, 'Lost reason is required');
  assert.equal(result.errors.reconnectDate, 'Reconnect date is required');
});

test('referral and percentage commission fields are validated', () => {
  const result = validateLeadPayload(validLead({
    source: 'Referral',
    commissionApplicable: true,
    commissionType: 'Percentage',
    commissionValue: 120
  }), { isCreate: true });
  assert.ok(result.errors.referrerType);
  assert.ok(result.errors.referrerName);
  assert.ok(result.errors.referrerContact);
  assert.equal(result.errors.commissionValue, 'Commission percentage must be between 0 and 100');
});

test('budget bounds, probability, email and URLs are validated', () => {
  const result = validateLeadPayload(validLead({
    email: 'invalid-email',
    website: 'javascript:alert(1)',
    budgetMin: 50000,
    budgetMax: 10000,
    conversionProbability: 101
  }), { isCreate: true });
  assert.ok(result.errors.email);
  assert.ok(result.errors.website);
  assert.ok(result.errors.budgetMax);
  assert.ok(result.errors.conversionProbability);
});
