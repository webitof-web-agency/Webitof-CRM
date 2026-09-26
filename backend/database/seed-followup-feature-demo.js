const { ensureDatabase } = require('../config/initDb');
const { closePool, query, withTransaction } = require('../config/db');
const leadModel = require('../models/lead.model');
const engine = require('../services/followUpEngine.service');

const SEED_NAME = 'followup-feature-demo-v1';
const PIPELINE_ID = 'pipe-followup-feature-demo';

function addHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function dateOnly(hours) {
  return addHours(hours).slice(0, 10);
}

function timeOnly(hours) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata'
  });
}

function demoLead(index, overrides = {}) {
  const number = String(index).padStart(2, '0');
  const companyName = overrides.companyName || `Followup Demo Client ${number}`;
  const contactPerson = overrides.contactPerson || `Demo Contact ${number}`;
  const domain = `followup-demo-${number}.test`;
  const value = overrides.value ?? (45000 + index * 18000);

  return {
    name: companyName,
    companyName,
    contactPerson,
    type: 'Organization',
    email: `contact${number}@${domain}`,
    phone: `+91 98${String(70000000 + index * 1371).padStart(8, '0')}`,
    whatsappNumber: `+91 98${String(70000000 + index * 1371).padStart(8, '0')}`,
    website: `https://${domain}`,
    preferredLanguage: 'Hindi',
    preferredContactMethod: overrides.followUpMode || 'Phone Call',
    preferredContactTime: '10:00 AM - 6:00 PM',
    status: overrides.status || 'Qualified',
    pipelineId: PIPELINE_ID,
    source: overrides.source || 'Demo Seed',
    campaignName: 'Follow-up feature QA',
    sourceReference: `FU-DEMO-${number}`,
    requiredServices: overrides.requiredServices || ['Website', 'CRM'],
    requirementTitle: overrides.requirementTitle || 'CRM follow-up demo requirement',
    requirementSummary: overrides.requirementSummary || 'Seed data created to test the follow-up command center.',
    requirementDescription: overrides.requirementDescription || 'Use this record to validate filters, counts, badges, detail modal, reminders, and follow-up actions.',
    clientPainPoints: overrides.clientPainPoints || 'Needs clear next action tracking.',
    expectedFeatures: overrides.expectedFeatures || 'Follow-up reminders, lead timeline, and sales visibility.',
    preferredTechnology: overrides.preferredTechnology || 'React, Node.js',
    expectedStartDate: dateOnly(72),
    expectedDeliveryDate: dateOnly(720),
    value,
    estimatedBudget: value,
    budgetMin: Math.round(value * 0.8),
    budgetMax: Math.round(value * 1.2),
    budgetRange: `Rs. ${Math.round(value * 0.8)} - Rs. ${Math.round(value * 1.2)}`,
    budgetConfirmed: 'Tentative',
    billingType: 'Project',
    gstInvoiceRequired: 'Yes',
    expectedClosingDate: dateOnly(240),
    paymentPreference: 'UPI / Bank Transfer',
    purchaseTimeline: overrides.purchaseTimeline || 'This month',
    leadTemperature: overrides.leadTemperature || (value > 150000 ? 'Hot' : 'Warm'),
    priority: overrides.leadPriority || (value > 150000 ? 'High' : 'Medium'),
    conversionProbability: overrides.conversionProbability || 65,
    leadScore: overrides.leadScore || Math.min(95, 45 + index * 2),
    statusNote: overrides.statusNote || 'Follow-up demo seed case.',
    followUpDate: dateOnly(overrides.followUpHours ?? 24),
    nextFollowUpTime: timeOnly(overrides.followUpHours ?? 24),
    followUpMode: overrides.followUpMode || 'Phone Call',
    reminder: '30 minutes before',
    followUpNote: overrides.followUpNote || 'Demo follow-up pending.',
    assignedTo: overrides.assignedTo,
    leadOwner: overrides.assignedTo,
    createdBy: overrides.createdBy,
    updatedBy: overrides.createdBy,
    address: overrides.address || `${number}, Demo Business Park`,
    city: overrides.city || 'Indore',
    state: overrides.state || 'Madhya Pradesh',
    pincode: overrides.pincode || `4520${number}`,
    country: 'India',
    currency: 'INR',
    currencySymbol: 'Rs.',
    labels: overrides.labels || ['Follow-up Demo', overrides.label || 'QA'],
    ownerName: contactPerson,
    notes: overrides.notes || 'Seeded for follow-up feature cross-checking.',
    firstConversationSummary: 'Initial requirement captured from demo seed.',
    lastConversationSummary: overrides.lastConversationSummary || 'Awaiting next follow-up action.',
    clientExpectations: 'Fast response and clear proposal.',
    internalNotes: `Demo seed: ${SEED_NAME}`,
    preferredCommunicationChannel: overrides.followUpMode || 'Phone Call',
    lastContactDate: dateOnly(-24),
    lastContactTime: timeOnly(-24),
    decisionMakerIdentified: 'Yes',
    contactIsDecisionMaker: true,
    requirementConfirmed: 'Yes',
    timelineConfirmed: 'Partial',
    authorityConfirmed: 'Yes',
    needConfirmed: 'Yes',
    qualificationNotes: 'Qualified demo record.',
    payload: {
      demoSeed: SEED_NAME,
      demoKey: `lead-${number}`,
      caseKey: overrides.caseKey || ''
    }
  };
}

const CASES = [
  {
    key: 'overdue',
    label: 'Overdue',
    lead: { companyName: 'Apex Overdue Systems', value: 85000, followUpMode: 'Phone Call', followUpHours: -30 },
    followUp: { title: 'Overdue quotation decision call', type: 'Call', purpose: 'Overdue decision', dueHours: -30, priority: 'High', nextAction: 'Call again and confirm decision.' }
  },
  {
    key: 'due_today',
    label: 'Due today',
    lead: { companyName: 'Bright Due Today Foods', followUpMode: 'Phone Call', followUpHours: 2 },
    followUp: { title: 'Due today discovery follow-up', type: 'Call', purpose: 'Discovery call', dueHours: 2, priority: 'Medium', nextAction: 'Capture requirement summary.' }
  },
  {
    key: 'critical',
    label: 'Critical',
    lead: { companyName: 'Crown Critical Manufacturing', value: 420000, leadPriority: 'Critical', followUpHours: 5 },
    followUp: { title: 'Critical high-value closure discussion', type: 'Call', purpose: 'Closure decision', dueHours: 5, priority: 'Critical', nextAction: 'Escalate to owner if no response.' }
  },
  {
    key: 'waiting_client',
    label: 'Waiting for client',
    lead: { companyName: 'Delta Waiting Client Retail', followUpMode: 'WhatsApp', followUpHours: 24 },
    followUp: { title: 'Waiting for client logo and content', type: 'Document follow-up', purpose: 'Content collection', dueHours: 24, priority: 'Medium', status: 'Waiting for Client', nextAction: 'Receive logo, images, and product list.', updatedHours: -60 }
  },
  {
    key: 'waiting_internal',
    label: 'Waiting internal',
    lead: { companyName: 'Elevate Internal Review Labs', followUpHours: 28 },
    followUp: { title: 'Waiting for internal estimate', type: 'Internal dependency', purpose: 'Technical estimate', dueHours: 28, priority: 'High', status: 'Waiting for Internal Team', nextAction: 'Get development estimate from team.', updatedHours: -72 }
  },
  {
    key: 'no_response',
    label: 'No response',
    lead: { companyName: 'Fusion No Response Traders', followUpMode: 'WhatsApp', followUpHours: 4 },
    followUp: { title: 'No response second attempt', type: 'WhatsApp', purpose: 'Second attempt', dueHours: 4, priority: 'Medium', status: 'No Response', nextAction: 'Send WhatsApp reminder.' }
  },
  {
    key: 'escalated',
    label: 'Escalated',
    lead: { companyName: 'Galaxy Escalated Hotels', value: 280000, leadPriority: 'Critical', followUpHours: -72 },
    followUp: { title: 'Escalated overdue proposal approval', type: 'Proposal follow-up', purpose: 'Management escalation', dueHours: -72, priority: 'Critical', status: 'Escalated', nextAction: 'Manager to call decision maker.', escalationLevel: 2 }
  },
  {
    key: 'rescheduled',
    label: 'Rescheduled',
    lead: { companyName: 'Harbor Reschedule Exports', followUpHours: 48 },
    followUp: { title: 'Rescheduled demo review', type: 'Demo', purpose: 'Demo review', dueHours: 48, priority: 'Medium', status: 'Rescheduled', nextAction: 'Run revised demo.', rescheduleCount: 3, lastRescheduleReason: 'Client requested new time.' }
  },
  {
    key: 'snoozed',
    label: 'Snoozed',
    lead: { companyName: 'Icon Snoozed Services', followUpHours: 6 },
    followUp: { title: 'Snoozed callback after lunch', type: 'Callback', purpose: 'Callback', dueHours: 6, priority: 'Low', status: 'Snoozed', nextAction: 'Call after lunch.', snoozeCount: 1 }
  },
  {
    key: 'in_progress',
    label: 'In progress',
    lead: { companyName: 'Jupiter In Progress Clinic', followUpHours: 1 },
    followUp: { title: 'In-progress requirement discussion', type: 'Meeting', purpose: 'Requirement discussion', dueHours: 1, priority: 'High', status: 'In Progress', nextAction: 'Finish requirement notes.' }
  },
  {
    key: 'visit_client',
    label: 'Visit client',
    lead: { companyName: 'Kaveri Client Visit School', followUpMode: 'Client Location Meeting', followUpHours: 30 },
    followUp: { title: 'Client office visit for proposal', type: 'Visit', purpose: 'Visit / Meeting', dueHours: 30, priority: 'High', location: 'Client office - Vijay Nagar, Indore', nextAction: 'Carry proposal printout and estimate.' }
  },
  {
    key: 'office_visit',
    label: 'Office visit',
    lead: { companyName: 'Lotus Office Visit Academy', followUpMode: 'Office Meeting', followUpHours: 52 },
    followUp: { title: 'Client visiting our office', type: 'Site visit', purpose: 'Visit / Meeting', dueHours: 52, priority: 'Medium', location: 'Our office conference room', nextAction: 'Prepare presentation room and demo account.' }
  },
  {
    key: 'video_meeting',
    label: 'Video meeting',
    lead: { companyName: 'Metro Video Meeting Finance', followUpMode: 'Video Meeting', followUpHours: 3 },
    followUp: { title: 'Video meeting for scope freeze', type: 'Video meeting', purpose: 'Scope freeze', dueHours: 3, priority: 'Medium', location: 'Google Meet link to be shared', nextAction: 'Share meeting link before call.' }
  },
  {
    key: 'missing_next_action',
    label: 'Missing next action',
    lead: { companyName: 'Nimbus Missing Action Logistics', followUpHours: 7 },
    followUp: { title: 'Follow-up with missing next action', type: 'Call', purpose: 'Needs next action', dueHours: 7, priority: 'Medium', nextAction: '' }
  },
  {
    key: 'completed',
    label: 'Completed',
    lead: { companyName: 'Orbit Completed Demo Works', status: 'Won', followUpHours: -4 },
    followUp: { title: 'Completed discovery follow-up', type: 'Call', purpose: 'Completed demo case', dueHours: -4, priority: 'Low', complete: true, nextAction: 'Closed after discussion.' }
  },
  {
    key: 'upcoming',
    label: 'Upcoming',
    lead: { companyName: 'Prime Upcoming Solar', followUpHours: 144 },
    followUp: { title: 'Upcoming proposal review next week', type: 'Email', purpose: 'Proposal review', dueHours: 144, priority: 'Low', nextAction: 'Send final proposal PDF.' }
  },
  {
    key: 'unassigned_followup',
    label: 'Unassigned follow-up',
    lead: { companyName: 'Quartz Unassigned Lead Care', followUpHours: 8, unassigned: true },
    followUp: { title: 'Unassigned follow-up queue check', type: 'Call', purpose: 'Assignment required', dueHours: 8, priority: 'High', unassigned: true, nextAction: 'Assign this lead to a team member.' }
  },
  {
    key: 'missing_lead_attention',
    label: 'Missing lead attention',
    lead: { companyName: 'Rapid Missing Followup Textiles', followUpHours: 72, noFollowUp: true, statusNote: 'No active follow-up by design for Attention tab.' }
  }
];

async function ensurePipeline(db) {
  await db.query(
    `insert into lead_pipelines (id, name, code, description, color, sort_order, is_active, payload)
     values ($1, 'Follow-up Feature Demo', 'follow-up-feature-demo', 'Leads seeded to test follow-up filters and counts.', '#2563eb', 95, true, $2::jsonb)
     on conflict (id) do update set name=excluded.name, description=excluded.description, color=excluded.color, is_active=true, updated_at=now()`,
    [PIPELINE_ID, JSON.stringify({ demoSeed: SEED_NAME })]
  );
}

async function ensureVisitMaster(db) {
  await db.query(
    `insert into master_items (id, type, name, is_active, sort_order, payload)
     values ('fumaster-visit', 'follow_up_type', 'Visit', true, 80, $1::jsonb)
     on conflict (type, name) do update set is_active=true, sort_order=excluded.sort_order, payload=master_items.payload || excluded.payload, updated_at=now()`,
    [JSON.stringify({ demoSeed: SEED_NAME })]
  );
}

async function getUsers(db) {
  const result = await db.query(
    `select id, username, email, full_name
     from users
     where is_active = true
     order by created_at asc
     limit 10`
  );
  return result.rows;
}

function pickUser(users, index) {
  if (!users.length) return null;
  return users[index % users.length].id;
}

async function cleanupPreviousFollowUps(db) {
  const old = await db.query(
    `select id from follow_ups where source = 'feature_demo_seed' or payload->>'demoSeed' = $1`,
    [SEED_NAME]
  );
  const ids = old.rows.map((row) => row.id);
  if (ids.length) {
    await db.query(`delete from lead_events where payload->>'followUpId' = any($1::text[])`, [ids]);
    await db.query(`delete from follow_ups where id = any($1::text[])`, [ids]);
  }
  await db.query(`delete from lead_events where payload->>'demoSeed' = $1`, [SEED_NAME]);
  return ids.length;
}

async function upsertLead(db, data) {
  const existing = await db.query(
    `select id from leads where payload->>'demoSeed' = $1 and payload->>'demoKey' = $2 limit 1`,
    [SEED_NAME, data.payload.demoKey]
  );
  if (existing.rows[0]) {
    return leadModel.update(existing.rows[0].id, data, db);
  }
  return leadModel.create(data, db);
}

async function createDemoContactAndEvent(db, lead, caseDef, userId) {
  await db.query(
    `delete from lead_contacts where lead_id = $1 and payload->>'demoSeed' = $2`,
    [lead.id, SEED_NAME]
  );
  await db.query(
    `delete from lead_events where lead_id = $1 and payload->>'demoSeed' = $2`,
    [lead.id, SEED_NAME]
  );
  await db.query(
    `insert into lead_contacts (id, lead_id, first_name, last_name, email, phone, job_title, gender, notes, payload)
     values ($1, $2, $3, $4, $5, $6, 'Decision Maker', 'Other', $7, $8::jsonb)`,
    [
      `demo-contact-${caseDef.key}`,
      lead.id,
      String(lead.contactPerson || 'Demo').split(' ')[0],
      String(lead.contactPerson || 'Contact').split(' ').slice(1).join(' ') || 'Contact',
      lead.email,
      lead.phone,
      `Primary contact for ${caseDef.label}.`,
      JSON.stringify({ demoSeed: SEED_NAME, caseKey: caseDef.key })
    ]
  );
  await db.query(
    `insert into lead_events
      (id, lead_id, scope_type, scope_id, owner_user_id, visibility, event_type, title, description, start_date, start_time, end_date, end_time, labels, color, payload)
     values ($1, $2, 'lead', $2, $3, 'all_team', 'event', $4, $5, current_date, '10:00', current_date, '10:30', $6::jsonb, '#2563eb', $7::jsonb)
     on conflict (id) do update set title=excluded.title, description=excluded.description, payload=excluded.payload`,
    [
      `demo-lead-event-${caseDef.key}`,
      lead.id,
      userId,
      `${caseDef.label} seed activity`,
      `Activity seeded for ${caseDef.key} follow-up QA.`,
      JSON.stringify(['Follow-up Demo', caseDef.label]),
      JSON.stringify({ demoSeed: SEED_NAME, caseKey: caseDef.key })
    ]
  );
}

async function applyFollowUpState(db, followUpId, patch) {
  const assignments = [];
  const values = [];
  Object.entries(patch).forEach(([column, value]) => {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  });
  values.push(followUpId);
  await db.query(
    `update follow_ups set ${assignments.join(', ')}, updated_at = now(), payload = payload || $${values.length + 1}::jsonb where id = $${values.length}`,
    [...values, JSON.stringify({ demoSeed: SEED_NAME })]
  );
}

async function createDemoFollowUp(db, lead, caseDef, actor, assigneeId) {
  const config = caseDef.followUp;
  const result = await engine.createFollowUp({
    relatedEntityType: 'Lead',
    relatedEntityId: lead.id,
    relatedEntityLabel: lead.companyName || lead.name,
    title: config.title,
    description: `Demo condition: ${caseDef.label}. ${config.nextAction || 'No next action set for QA.'}`,
    followUpType: config.type,
    purpose: config.purpose,
    dueAt: addHours(config.dueHours),
    timezone: 'Asia/Kolkata',
    expectedDurationMinutes: config.type === 'Visit' || config.type === 'Site visit' ? 60 : 30,
    priority: config.priority,
    priorityReason: `${caseDef.label} QA seed`,
    status: 'Scheduled',
    expectedOutcome: config.expectedOutcome || 'Next step confirmed',
    nextAction: config.nextAction,
    location: config.location || '',
    tags: ['Follow-up Demo', caseDef.label],
    assignedTo: config.unassigned ? null : assigneeId,
    source: 'feature_demo_seed',
    reminderSettings: [{ channel: 'inApp', minutesBefore: 30 }],
    isRecurring: Boolean(config.isRecurring),
    recurrenceRule: config.isRecurring ? { frequency: 'weekly', interval: 1, respectBusinessHours: true } : {}
  }, config.unassigned ? null : actor, { db, system: true });

  const patch = {
    source: 'feature_demo_seed',
    priority: config.priority,
    next_action: config.nextAction || null
  };
  if (config.status) patch.status = config.status;
  if (config.unassigned) {
    patch.assigned_to = null;
    patch.created_by = null;
  }
  if (config.rescheduleCount) patch.reschedule_count = config.rescheduleCount;
  if (config.snoozeCount) patch.snooze_count = config.snoozeCount;
  if (config.escalationLevel) {
    patch.escalation_level = config.escalationLevel;
    patch.last_escalation_at = addHours(-1);
  }
  if (config.lastRescheduleReason) patch.last_reschedule_reason = config.lastRescheduleReason;
  await applyFollowUpState(db, result.record.id, patch);
  if (config.updatedHours != null) {
    await db.query(`update follow_ups set updated_at = $1 where id = $2`, [addHours(config.updatedHours), result.record.id]);
  }

  if (config.complete) {
    await engine.completeFollowUp(result.record.id, {
      actualOutcome: 'Connected',
      communicationResult: 'Connected',
      discussionNote: 'Completed demo follow-up. Requirement understood and no next action required.',
      noNextFollowUpReason: 'Demo completed case',
      relatedStatus: 'Won'
    }, actor, { db, system: true });
    await applyFollowUpState(db, result.record.id, { source: 'feature_demo_seed' });
  }

  return result.record.id;
}

async function main() {
  if (!process.argv.includes('--yes-demo')) {
    throw new Error('Pass --yes-demo to seed follow-up feature demo data.');
  }

  await ensureDatabase();

  const summary = await withTransaction(async (db) => {
    await ensurePipeline(db);
    await ensureVisitMaster(db);
    const deletedFollowUps = await cleanupPreviousFollowUps(db);
    const users = await getUsers(db);
    const actorId = pickUser(users, 0);
    const actor = { id: actorId, isSuperAdmin: true, permissions: ['followups.view_all'] };

    const createdLeadIds = [];
    const createdFollowUpIds = [];

    for (let index = 0; index < CASES.length; index += 1) {
      const caseDef = CASES[index];
      const assigneeId = caseDef.lead.unassigned ? null : pickUser(users, index);
      const lead = await upsertLead(db, demoLead(index + 1, {
        ...caseDef.lead,
        assignedTo: assigneeId,
        createdBy: actorId,
        caseKey: caseDef.key,
        label: caseDef.label
      }));
      createdLeadIds.push(lead.id);
      await createDemoContactAndEvent(db, lead, caseDef, actorId);

      if (caseDef.followUp) {
        const followUpId = await createDemoFollowUp(db, lead, caseDef, actor, pickUser(users, index));
        createdFollowUpIds.push(followUpId);
      }
    }

    return {
      deletedFollowUps,
      leads: createdLeadIds.length,
      followUps: createdFollowUpIds.length,
      missingFollowUpLeads: CASES.filter((item) => !item.followUp).length,
      cases: CASES.map((item) => item.key)
    };
  });

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error('Failed to seed follow-up feature demo data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
