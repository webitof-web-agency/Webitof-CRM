const path = require('path');
const assert = require('node:assert/strict');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool, query, closePool } = require('../config/db');

const baseUrl = process.env.TEST_API_URL || 'http://127.0.0.1:5000/api';

async function api(pathname, { method = 'GET', token = '', body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json();
  return { response, payload };
}

async function run() {
  const before = await query('select count(*)::int as count from leads');
  let leadId = '';
  let clientId = '';
  let projectId = '';

  try {
    const login = await api('/auth/login', {
      method: 'POST',
      body: {
        identifier: process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@webitof.com',
        password: process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Admin@12345'
      }
    });
    assert.equal(login.response.status, 200, login.payload.message);
    const token = login.payload.data?.token;
    assert.ok(token);

    const options = await api('/leads/options', { token });
    assert.equal(options.response.status, 200);
    const serviceOptions = options.payload.data.services || [];
    assert.ok(serviceOptions.length, 'Lead options must include at least one service');
    assert.ok(serviceOptions.includes('Other'), 'Lead options must include Other for custom services');
    const selectedServices = serviceOptions.includes('CRM Development')
      ? ['CRM Development']
      : [serviceOptions.find((service) => service !== 'Other') || 'Other'];

    const suffix = Date.now().toString().slice(-8);
    const phone = `+9197${suffix}`;
    const email = `lead-smoke-${suffix}@example.test`;
    const created = await api('/leads', {
      method: 'POST',
      token,
      body: {
        type: 'Organization',
        companyName: `Lead API Smoke ${suffix}`,
        contactPerson: 'API Smoke Contact',
        phone,
        email,
        requiredServices: selectedServices,
        otherServiceDetails: selectedServices.includes('Other') ? 'API smoke custom service' : '',
        requirementSummary: 'API compatibility verification',
        source: 'Website',
        status: 'New',
        originalLeadId: '',
        pipelineId: 'pipe-default',
        estimatedBudget: 75000,
        currency: 'INR',
        leadTemperature: 'Warm',
        priority: 'High'
      }
    });
    assert.equal(created.response.status, 201, created.payload.message);
    leadId = created.payload.data.id;
    assert.ok(created.payload.data.leadNumber);

    const duplicates = await api(`/leads/duplicates?phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}&excludeId=none`, { token });
    assert.equal(duplicates.response.status, 200);
    assert.ok(duplicates.payload.data.some((lead) => lead.id === leadId));

    const updated = await api(`/leads/${leadId}`, {
      method: 'PUT',
      token,
      body: {
        budgetMin: 50000,
        budgetMax: 100000,
        conversionProbability: 65,
        decisionMakerIdentified: 'Yes',
        requirementConfirmed: 'Yes',
        timelineConfirmed: 'Yes'
      }
    });
    assert.equal(updated.response.status, 200, updated.payload.message);
    assert.ok(updated.payload.data.leadScore >= 60);

    const bulkAssigned = await api('/leads/bulk', {
      method: 'POST',
      token,
      body: { ids: [leadId], action: 'assign', assignedTo: created.payload.data.assignedTo }
    });
    assert.equal(bulkAssigned.response.status, 200, bulkAssigned.payload.message);
    assert.equal(bulkAssigned.payload.count, 1);

    const bulkStatus = await api('/leads/bulk', {
      method: 'POST',
      token,
      body: { ids: [leadId], action: 'status', status: 'Contacted', statusNote: 'Bulk API verification' }
    });
    assert.equal(bulkStatus.response.status, 200, bulkStatus.payload.message);
    assert.equal(bulkStatus.payload.data[0].status, 'Contacted');

    const bulkFollowUp = await api('/leads/bulk', {
      method: 'POST',
      token,
      body: {
        ids: [leadId],
        action: 'follow_up',
        followUpDate: '2026-08-14',
        nextFollowUpTime: '10:30',
        followUpMode: 'Email',
        reminder: '30 Minutes Before'
      }
    });
    assert.equal(bulkFollowUp.response.status, 200, bulkFollowUp.payload.message);
    assert.equal(bulkFollowUp.payload.count, 1);

    const invalidBudget = await api(`/leads/${leadId}`, {
      method: 'PUT',
      token,
      body: { budgetMin: 120000, budgetMax: 10000 }
    });
    assert.equal(invalidBudget.response.status, 400);
    assert.ok(invalidBudget.payload.details?.budgetMax);

    const followUp = await api(`/leads/${leadId}/follow-ups`, {
      method: 'POST',
      token,
      body: {
        followUpDate: '2026-08-15',
        nextFollowUpTime: '11:30',
        followUpMode: 'Phone Call',
        reminder: '1 Hour Before',
        followUpNote: 'API follow-up verification'
      }
    });
    assert.equal(followUp.response.status, 201, followUp.payload.message);

    const call = await api(`/leads/${leadId}/calls`, {
      method: 'POST',
      token,
      body: {
        callType: 'Outgoing',
        callDateTime: '2026-07-29T11:30:00+05:30',
        callDuration: 120,
        callerNumber: phone,
        callOutcome: 'Requirement Collected',
        callNotes: 'API call logging verification'
      }
    });
    assert.equal(call.response.status, 201, call.payload.message);

    const invalidLost = await api(`/leads/${leadId}/lost`, { method: 'POST', token, body: {} });
    assert.equal(invalidLost.response.status, 400);
    assert.ok(invalidLost.payload.details?.lostReason);

    const lost = await api(`/leads/${leadId}/lost`, {
      method: 'POST',
      token,
      body: { lostReason: 'Timeline Issue', lostReasonNotes: 'Test status transition' }
    });
    assert.equal(lost.response.status, 200, lost.payload.message);

    const reopened = await api(`/leads/${leadId}/reopen`, { method: 'POST', token, body: { status: 'Follow-up' } });
    assert.equal(reopened.response.status, 200, reopened.payload.message);
    assert.ok(reopened.payload.data.reopenedAt);

    const preview = await api(`/leads/${leadId}/conversion-preview`, { token });
    assert.equal(preview.response.status, 200, preview.payload.message);

    const converted = await api(`/leads/${leadId}/convert`, {
      method: 'POST',
      token,
      body: { forceCreateClient: true, createProject: true, projectTitle: `Smoke Project ${suffix}` }
    });
    assert.equal(converted.response.status, 200, converted.payload.message);
    assert.equal(converted.payload.deletedLead, false);
    clientId = converted.payload.clientId;
    projectId = converted.payload.projectId;
    assert.ok(clientId);
    assert.ok(projectId);

    const retained = await api(`/leads/${leadId}`, { token });
    assert.equal(retained.response.status, 200);
    assert.equal(retained.payload.data.convertedClientId, clientId);
    assert.equal(retained.payload.data.convertedProjectId, projectId);

    const history = await api(`/leads/${leadId}/history`, { token });
    assert.equal(history.response.status, 200);
    assert.ok(history.payload.data.some((event) => event.payload?.kind === 'converted'));

    console.log(JSON.stringify({
      create: true,
      duplicateWarning: true,
      validation: true,
      followUp: true,
      callLog: true,
      bulkActions: true,
      lostAndReopen: true,
      conversionRetainedLead: true,
      history: true
    }));
  } finally {
    if (leadId || clientId || projectId) {
      const cleanup = await pool.connect();
      try {
        await cleanup.query('begin');
        if (leadId) await cleanup.query('delete from lead_conversion_mappings where lead_id = $1', [leadId]);
        if (projectId) await cleanup.query('delete from projects where id = $1', [projectId]);
        if (leadId) await cleanup.query('delete from leads where id = $1', [leadId]);
        if (clientId) await cleanup.query('delete from clients where id = $1', [clientId]);
        await cleanup.query('commit');
      } catch (error) {
        await cleanup.query('rollback');
        throw error;
      } finally {
        cleanup.release();
      }
    }
    const after = await query('select count(*)::int as count from leads');
    assert.equal(after.rows[0].count, before.rows[0].count, 'Smoke test must restore the original lead count');
    await closePool();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
