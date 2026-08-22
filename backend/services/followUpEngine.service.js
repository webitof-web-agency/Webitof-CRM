const followUpModel = require('../models/followUp.model');
const leadEventModel = require('../models/leadEvent.model');
const { query, withTransaction } = require('../config/db');
const { hasPermission } = require('../middlewares/auth');
const { createId } = require('../utils/format');

const ACTIVE_FOLLOW_UP_STATUSES = [
  'Scheduled', 'Due Today', 'In Progress', 'Rescheduled', 'Snoozed',
  'Waiting for Client', 'Waiting for Internal Team', 'No Response', 'Escalated'
];
const CLOSED_FOLLOW_UP_STATUSES = ['Completed', 'Cancelled', 'Failed', 'Auto-Closed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const FOLLOW_UP_TYPES = [
  'Call', 'Callback', 'WhatsApp', 'Email', 'Meeting', 'Video meeting', 'Demo', 'Site visit',
  'Proposal follow-up', 'Quotation follow-up', 'Payment follow-up', 'Document follow-up',
  'Requirement follow-up', 'Client approval', 'Internal dependency', 'Project review',
  'Support follow-up', 'Renewal follow-up', 'Feedback', 'Testimonial', 'Referral', 'Custom'
];
const OUTCOMES = [
  'Connected', 'Not Connected', 'Busy', 'Switched Off', 'Wrong Number', 'Callback Requested',
  'Interested', 'Highly Interested', 'Not Interested', 'Proposal Requested', 'Demo Requested',
  'Budget Issue', 'Decision Pending', 'Meeting Scheduled', 'Quotation Approved', 'Revision Requested',
  'Payment Promised', 'Payment Received', 'Requirement Pending', 'Client Approval Pending',
  'Internal Dependency', 'Resolved', 'Custom'
];

const ENTITY_DEFINITIONS = {
  Lead: { table: 'leads', permission: 'leads.read', label: `coalesce(contact_person, company_name, name, lead_number, id)`, owner: 'coalesce(assigned_to, lead_owner)', client: 'converted_client_id', status: 'status' },
  Contact: { table: 'client_contacts', permission: 'clients.read', label: `trim(concat_ws(' ', first_name, last_name))`, owner: 'null', client: 'client_id', status: `''` },
  Client: { table: 'clients', permission: 'clients.read', label: `coalesce(company_name, name, id)`, owner: 'assigned_to', client: 'id', status: 'status' },
  Opportunity: { table: 'leads', permission: 'leads.read', label: `coalesce(contact_person, company_name, name, lead_number, id)`, owner: 'coalesce(assigned_to, lead_owner)', client: 'converted_client_id', status: 'status' },
  Deal: { table: 'leads', permission: 'leads.read', label: `coalesce(contact_person, company_name, name, lead_number, id)`, owner: 'coalesce(assigned_to, lead_owner)', client: 'converted_client_id', status: 'status' },
  Quotation: { table: 'lead_events', permission: 'leads.read', label: `coalesce(title, id)`, owner: 'owner_user_id', client: 'null', status: `coalesce(payload->>'status', '')`, lead: 'lead_id' },
  Proposal: { table: 'lead_events', permission: 'leads.read', label: `coalesce(title, id)`, owner: 'owner_user_id', client: 'null', status: `coalesce(payload->>'status', '')`, lead: 'lead_id' },
  Invoice: { table: 'invoices', permission: 'invoices.read', label: `coalesce(invoice_number, id)`, owner: 'null', client: 'client_id', project: 'project_id', status: 'status' },
  Payment: { table: 'payments', permission: 'payments.read', label: `coalesce(transaction_id, id)`, owner: 'null', client: 'client_id', project: 'project_id', invoice: 'invoice_id', status: 'payment_status' },
  Project: { table: 'projects', permission: 'projects.read', label: `coalesce(title, id)`, owner: `coalesce(payload->>'assignedTo', payload->>'projectManagerId')`, client: 'client_id', status: 'status' },
  Task: { table: 'lead_events', permission: 'leads.read', label: `coalesce(title, id)`, owner: 'owner_user_id', client: 'client_id', project: 'project_id', lead: 'lead_id', status: `coalesce(payload->>'status', '')` },
  AMC: { table: 'amcs', permission: 'amc.read', label: `coalesce(title, id)`, owner: `payload->>'assignedTo'`, client: 'client_id', project: 'project_id', status: 'status' },
  Renewal: { table: 'renewals', permission: 'renewals.read', label: `coalesce(domain_name, hosting_name, package_name, software_name, category, id)`, owner: `payload->>'assignedTo'`, client: 'client_id', project: 'project_id', status: 'status' }
};

function validationError(details, message = 'Please correct the highlighted fields') {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = details;
  return error;
}

function forbidden(message = 'You do not have permission to access this follow-up') {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

function normalizeEntityType(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const found = Object.keys(ENTITY_DEFINITIONS).find((key) => key.toLowerCase() === raw.toLowerCase());
  if (found) return found;
  if (raw.toLowerCase() === 'ticket' || raw.toLowerCase() === 'support ticket') return 'Custom';
  return raw.toLowerCase() === 'custom' ? 'Custom' : raw;
}

function parseDateTime(value, date, time = '09:30', timezone = 'Asia/Kolkata') {
  const raw = String(value || '').trim();
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (!date) return null;
  const offset = timezone === 'Asia/Kolkata' ? '+05:30' : '';
  const parsed = new Date(`${String(date).slice(0, 10)}T${String(time || '09:30').slice(0, 5)}:00${offset}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function dateTimeParts(value, timezone = 'Asia/Kolkata') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function calculateEffectiveStatus(followUp, now = new Date(), timezone = 'Asia/Kolkata') {
  const persisted = String(followUp?.status || 'Scheduled');
  if (CLOSED_FOLLOW_UP_STATUSES.includes(persisted)) return persisted;
  const due = new Date(followUp?.dueAt || followUp?.due_at || followUp?.scheduledAt || 0);
  if (Number.isNaN(due.getTime())) return persisted;
  if (due.getTime() < now.getTime()) return 'Overdue';
  const dueDate = dateTimeParts(due, timezone).date;
  const today = dateTimeParts(now, timezone).date;
  if (dueDate === today && persisted === 'Scheduled') return 'Due Today';
  return persisted;
}

function calculateOverdueSeconds(followUp, now = new Date()) {
  const due = new Date(followUp?.dueAt || followUp?.due_at || 0);
  if (Number.isNaN(due.getTime()) || due >= now || CLOSED_FOLLOW_UP_STATUSES.includes(followUp?.status)) return 0;
  return Math.floor((now.getTime() - due.getTime()) / 1000);
}

function calculatePriority(context = {}) {
  const current = PRIORITIES.includes(context.priority) ? context.priority : 'Medium';
  const reasons = [];
  let score = PRIORITIES.indexOf(current);
  const value = Number(context.dealValue || context.quotationValue || context.outstandingAmount || 0);
  const overdueHours = Number(context.overdueHours || 0);
  const unansweredAttempts = Number(context.unansweredAttempts || 0);
  const daysToExpiry = context.daysToExpiry == null ? null : Number(context.daysToExpiry);

  if (value >= 250000) {
    score = Math.max(score, 2);
    reasons.push(`Value is ₹${value.toLocaleString('en-IN')}, above the ₹2,50,000 risk threshold`);
  }
  if (value >= 1000000) {
    score = 3;
    reasons.push('High-value business record requires critical attention');
  }
  if (overdueHours >= 24) {
    score = Math.max(score, 2);
    reasons.push(`Follow-up is overdue by ${Math.floor(overdueHours)} hours`);
  }
  if (overdueHours >= 72) score = 3;
  if (unansweredAttempts >= 3) {
    score = Math.max(score, 2);
    reasons.push(`${unansweredAttempts} attempts have not received a response`);
  }
  if (daysToExpiry != null && daysToExpiry <= 7) {
    score = Math.max(score, daysToExpiry < 0 ? 3 : 2);
    reasons.push(daysToExpiry < 0 ? 'Renewal expiry date has passed' : `Renewal expires in ${daysToExpiry} days`);
  }
  if (context.promiseMissed) {
    score = 3;
    reasons.push('Payment promise date has passed');
  }
  return { priority: PRIORITIES[Math.min(3, Math.max(0, score))], reason: reasons.join(' · ') || 'Set manually' };
}

function matchesConditions(record = {}, conditions = {}) {
  return Object.entries(conditions || {}).every(([key, expected]) => {
    const actual = key.split('.').reduce((value, part) => value?.[part], record);
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$eq' in expected && actual !== expected.$eq) return false;
      if ('$ne' in expected && actual === expected.$ne) return false;
      if ('$gt' in expected && !(Number(actual) > Number(expected.$gt))) return false;
      if ('$gte' in expected && !(Number(actual) >= Number(expected.$gte))) return false;
      if ('$lt' in expected && !(Number(actual) < Number(expected.$lt))) return false;
      if ('$lte' in expected && !(Number(actual) <= Number(expected.$lte))) return false;
      if ('$in' in expected && !(Array.isArray(expected.$in) && expected.$in.map(String).includes(String(actual)))) return false;
      if ('$contains' in expected && !(Array.isArray(actual) ? actual.map(String).includes(String(expected.$contains)) : String(actual || '').includes(String(expected.$contains)))) return false;
      return true;
    }
    if (Array.isArray(expected)) return expected.map(String).includes(String(actual));
    return String(actual ?? '') === String(expected ?? '');
  });
}

function calculateReminderAt(dueAt, minutesBefore = 0) {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  return new Date(due.getTime() - Math.max(0, Number(minutesBefore || 0)) * 60000).toISOString();
}

function getEscalationLevel(overdueMinutes, schedule = []) {
  return (Array.isArray(schedule) ? schedule : []).reduce(
    (level, item) => Number(overdueMinutes || 0) >= Number(item.minutesOverdue || 0) ? Math.max(level, Number(item.level || 0)) : level,
    0
  );
}

function scheduleRetry(attempt, baseTime = new Date(), retryPolicy = {}, settings = {}) {
  const delays = Array.isArray(retryPolicy.delaysMinutes) ? retryPolicy.delaysMinutes : [120, 1440, 2880];
  const index = Math.max(0, Number(attempt || 1) - 1);
  if (index >= delays.length || Number(attempt || 1) > Number(retryPolicy.maxAttempts || 5)) return null;
  const candidate = new Date(new Date(baseTime).getTime() + Number(delays[index]) * 60000);
  return retryPolicy.respectBusinessHours === false ? candidate.toISOString() : nextBusinessTime(candidate, settings);
}

function isWithinBusinessHours(value, settings = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const timezone = settings.timezone || 'Asia/Kolkata';
  const parts = dateTimeParts(date, timezone);
  const local = new Date(`${parts.date}T${parts.time}:00`);
  const weekday = local.getDay();
  const business = settings.businessHours || settings.business_hours || {};
  const workingDays = Array.isArray(business.workingDays) ? business.workingDays : [1, 2, 3, 4, 5, 6];
  if (!workingDays.includes(weekday)) return false;
  if ((settings.holidayDates || settings.holiday_dates || []).includes(parts.date)) return false;
  const start = business.start || '09:30';
  const end = business.end || '18:30';
  return parts.time >= start && parts.time <= end;
}

function nextBusinessTime(value, settings = {}) {
  const timezone = settings.timezone || 'Asia/Kolkata';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (isWithinBusinessHours(date, settings)) return date.toISOString();
  const business = settings.businessHours || settings.business_hours || {};
  const start = business.start || '09:30';
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(date);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    const parts = dateTimeParts(candidate, timezone);
    const parsed = parseDateTime('', parts.date, start, timezone);
    if (parsed && isWithinBusinessHours(parsed, settings) && new Date(parsed) > date) return parsed;
  }
  return date.toISOString();
}

function getNextRecurrenceAt(dueAt, rule = {}, settings = {}) {
  if (!rule || typeof rule !== 'object' || !rule.frequency) return null;
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return null;
  const interval = Math.max(1, Number(rule.interval || 1));
  if (rule.frequency === 'daily') date.setUTCDate(date.getUTCDate() + interval);
  else if (rule.frequency === 'weekly') date.setUTCDate(date.getUTCDate() + (7 * interval));
  else if (rule.frequency === 'monthly') date.setUTCMonth(date.getUTCMonth() + interval);
  else if (rule.frequency === 'quarterly') date.setUTCMonth(date.getUTCMonth() + (3 * interval));
  else if (rule.frequency === 'yearly') date.setUTCFullYear(date.getUTCFullYear() + interval);
  else if (rule.frequency === 'custom') date.setUTCDate(date.getUTCDate() + Math.max(1, Number(rule.intervalDays || interval)));
  else return null;
  if (rule.endDate && date > new Date(`${rule.endDate}T23:59:59Z`)) return null;
  return rule.respectBusinessHours === false ? date.toISOString() : nextBusinessTime(date, settings);
}

function canViewAll(user) {
  return Boolean(user?.isSuperAdmin || hasPermission(user, 'followups.view_all'));
}

function userTeamIds(user) {
  const values = user?.payload?.teamIds || user?.payload?.teams || user?.teamIds || [];
  return (Array.isArray(values) ? values : [values]).map(String).filter(Boolean);
}

function buildAccessClause(user, values, alias = 'f') {
  if (canViewAll(user)) return 'true';
  const teams = userTeamIds(user);
  values.push(user?.id || '');
  const userParam = `$${values.length}`;
  if (hasPermission(user, 'followups.view_team') && teams.length) {
    values.push(teams);
    return `(${alias}.assigned_to = ${userParam} OR ${alias}.created_by = ${userParam} OR ${alias}.assigned_team = ANY($${values.length}::text[]))`;
  }
  return `(${alias}.assigned_to = ${userParam} OR ${alias}.created_by = ${userParam})`;
}

function assertCanMutate(record, user, action = 'edit') {
  if (!record) return;
  if (user?.isSuperAdmin || hasPermission(user, `followups.${action}_any`) || hasPermission(user, 'followups.edit_any')) return;
  if (String(record.assignedTo || '') === String(user?.id || '') || String(record.createdBy || '') === String(user?.id || '')) return;
  throw forbidden();
}

async function getSettings(db = null) {
  const exec = db?.query ? db.query.bind(db) : query;
  const result = await exec(`select * from follow_up_settings where id = 'default' limit 1`);
  const row = result.rows[0] || {};
  return {
    id: row.id || 'default',
    timezone: row.timezone || 'Asia/Kolkata',
    businessHours: row.business_hours || {},
    holidayDates: row.holiday_dates || [],
    protectionThresholds: row.protection_thresholds || {},
    defaultReminders: row.default_reminders || [],
    escalationSchedule: row.escalation_schedule || [],
    retryPolicy: row.retry_policy || {},
    featureFlags: row.feature_flags || {},
    updatedAt: row.updated_at || null
  };
}

async function updateSettings(patch = {}, actorUserId = null) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await query(
    `update follow_up_settings set timezone = $1, business_hours = $2::jsonb, holiday_dates = $3::jsonb,
       protection_thresholds = $4::jsonb, default_reminders = $5::jsonb, escalation_schedule = $6::jsonb,
       retry_policy = $7::jsonb, feature_flags = $8::jsonb, updated_at = now() where id = 'default'`,
    [next.timezone, JSON.stringify(next.businessHours || {}), JSON.stringify(next.holidayDates || []),
      JSON.stringify(next.protectionThresholds || {}), JSON.stringify(next.defaultReminders || []),
      JSON.stringify(next.escalationSchedule || []), JSON.stringify(next.retryPolicy || {}), JSON.stringify(next.featureFlags || {})]
  );
  await query(
    `insert into follow_up_audit_logs (id, follow_up_id, action, actor_user_id, old_values, new_values, metadata)
     values ($1, null, 'settings_updated', $2, $3::jsonb, $4::jsonb, '{}'::jsonb)`,
    [createId('fuaudit'), actorUserId, JSON.stringify(current), JSON.stringify(next)]
  );
  return getSettings();
}

async function findRelatedEntity(type, id, db = null) {
  const normalizedType = normalizeEntityType(type);
  if (normalizedType === 'Custom') return { type: 'Custom', id: String(id), label: String(id), ownerUserId: null, status: '' };
  const definition = ENTITY_DEFINITIONS[normalizedType];
  if (!definition || !id) return null;
  const exec = db?.query ? db.query.bind(db) : query;
  const result = await exec(
    `select id, ${definition.label} as label, ${definition.owner} as owner_user_id,
      ${definition.client || 'null'} as client_id, ${definition.project || 'null'} as project_id,
      ${definition.invoice || 'null'} as invoice_id, ${definition.lead || 'null'} as lead_id,
      ${definition.status || `''`} as status, payload
     from ${definition.table} where id = $1 limit 1`,
    [String(id)]
  );
  return result.rows[0] ? { ...result.rows[0], type: normalizedType } : null;
}

function assertRelatedPermission(user, entityType) {
  const definition = ENTITY_DEFINITIONS[normalizeEntityType(entityType)];
  if (!definition || user?.isSuperAdmin || hasPermission(user, definition.permission)) return;
  throw forbidden(`Missing permission for related ${entityType} record`);
}

async function assertActiveAssignee(userId, db) {
  if (!userId) return;
  const result = await db.query('select id from users where id = $1 and is_active = true limit 1', [userId]);
  if (!result.rows[0]) throw validationError({ assignedTo: 'Select an active employee' });
}

function normalizeFollowUpInput(input = {}, context = {}, settings = {}) {
  const entityType = normalizeEntityType(input.relatedEntityType || context.type);
  const entityId = String(input.relatedEntityId || context.id || '').trim();
  const timezone = String(input.timezone || settings.timezone || 'Asia/Kolkata');
  const dueAt = parseDateTime(input.dueAt || input.scheduledAt, input.date || input.followUpDate, input.time || input.nextFollowUpTime, timezone);
  const errors = {};
  if (!entityType) errors.relatedEntityType = 'Related record type is required';
  if (!entityId) errors.relatedEntityId = 'Related record is required';
  if (!String(input.title || '').trim()) errors.title = 'Title is required';
  if (!dueAt) errors.dueAt = 'A valid due date and time is required';
  if (Object.keys(errors).length) throw validationError(errors);
  const priorityResult = calculatePriority({ ...(input.priorityContext || {}), priority: input.priority });
  return {
    relatedEntityType: entityType,
    relatedEntityId: entityId,
    relatedEntityLabel: input.relatedEntityLabel || context.label || entityId,
    leadId: input.leadId || context.lead_id || (entityType === 'Lead' ? entityId : null),
    clientId: input.clientId || context.client_id || (entityType === 'Client' ? entityId : null),
    projectId: input.projectId || context.project_id || (entityType === 'Project' ? entityId : null),
    invoiceId: input.invoiceId || context.invoice_id || (entityType === 'Invoice' ? entityId : null),
    renewalId: input.renewalId || (entityType === 'Renewal' ? entityId : null),
    title: String(input.title).trim(),
    description: String(input.description || '').trim(),
    followUpType: String(input.followUpType || input.type || 'Call').trim(),
    purpose: String(input.purpose || '').trim(),
    scheduledAt: parseDateTime(input.scheduledAt, input.date || input.followUpDate, input.time || input.nextFollowUpTime, timezone) || dueAt,
    dueAt,
    timezone,
    expectedDurationMinutes: Math.max(5, Number(input.expectedDurationMinutes || input.duration || 30)),
    priority: priorityResult.priority,
    priorityReason: input.priorityReason || priorityResult.reason,
    status: ACTIVE_FOLLOW_UP_STATUSES.includes(input.status) ? input.status : 'Scheduled',
    leadStageAtCreation: input.leadStageAtCreation || context.status || '',
    expectedOutcome: String(input.expectedOutcome || '').trim(),
    nextAction: String(input.nextAction || '').trim(),
    internalNote: String(input.internalNote || '').trim(),
    customerVisibleNote: String(input.customerVisibleNote || '').trim(),
    tags: Array.isArray(input.tags) ? input.tags : [],
    source: String(input.source || 'manual'),
    location: String(input.location || input.meetingLink || '').trim(),
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    assignedTo: input.assignedTo || context.owner_user_id || null,
    assignedTeam: input.assignedTeam || '',
    backupAssignee: input.backupAssignee || null,
    isAutomatic: Boolean(input.isAutomatic || input.source === 'automation' || input.source === 'sequence'),
    sequenceId: input.sequenceId || null,
    sequenceStepId: input.sequenceStepId || null,
    templateId: input.templateId || null,
    automationRuleId: input.automationRuleId || null,
    escalationRuleId: input.escalationRuleId || 'fuer-default',
    isRecurring: Boolean(input.isRecurring),
    recurrenceRule: input.recurrenceRule && typeof input.recurrenceRule === 'object' ? input.recurrenceRule : {},
    parentFollowUpId: input.parentFollowUpId || null,
    previousFollowUpId: input.previousFollowUpId || null,
    originalDueAt: input.originalDueAt || dueAt
  };
}

async function recordStatus(db, followUpId, previousStatus, nextStatus, actorUserId, reason = '', metadata = {}) {
  await db.query(
    `insert into follow_up_status_history (id, follow_up_id, previous_status, next_status, reason, changed_by, metadata)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [createId('fustatus'), followUpId, previousStatus || null, nextStatus, reason, actorUserId || null, JSON.stringify(metadata)]
  );
}

async function recordAudit(db, followUpId, action, actorUserId, oldValues = {}, newValues = {}, metadata = {}) {
  await db.query(
    `insert into follow_up_audit_logs (id, follow_up_id, action, actor_user_id, old_values, new_values, metadata)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
    [createId('fuaudit'), followUpId || null, action, actorUserId || null, JSON.stringify(oldValues), JSON.stringify(newValues), JSON.stringify(metadata)]
  );
}

async function createTimelineEvent(db, followUp, actorUserId, kind, description, meta = {}) {
  if (!followUp.leadId && !followUp.clientId && !followUp.projectId) return null;
  const due = dateTimeParts(followUp.dueAt, followUp.timezone);
  return leadEventModel.create({
    leadId: followUp.leadId || null,
    clientId: followUp.clientId || null,
    projectId: followUp.projectId || null,
    scopeType: followUp.leadId ? 'lead' : followUp.projectId ? 'project' : 'client',
    scopeId: followUp.leadId || followUp.projectId || followUp.clientId,
    ownerUserId: actorUserId || followUp.assignedTo || null,
    visibility: 'all_team',
    eventType: 'system',
    title: followUp.title,
    description: description || '',
    startDate: due.date || null,
    startTime: due.time || '',
    endDate: due.date || null,
    endTime: due.time || '',
    attachments: followUp.attachments || [],
    labels: followUp.tags || [],
    payload: { kind, followUpId: followUp.id, followUpNumber: followUp.followUpNumber, status: followUp.status, ...meta }
  }, db);
}

async function scheduleReminders(db, followUp, reminderSettings, settings) {
  const reminders = Array.isArray(reminderSettings) && reminderSettings.length ? reminderSettings : settings.defaultReminders;
  for (const reminder of reminders || []) {
    const minutesBefore = Math.max(0, Number(reminder.minutesBefore || 0));
    const scheduledAt = calculateReminderAt(followUp.dueAt, minutesBefore);
    const channel = String(reminder.channel || 'inApp');
    const key = `followup:${followUp.id}:${channel}:${minutesBefore}:${followUp.version || 1}`;
    await db.query(
      `insert into follow_up_reminders (id, follow_up_id, channel, recipient_user_id, scheduled_at, status, idempotency_key, payload)
       values ($1, $2, $3, $4, $5, 'pending', $6, $7::jsonb) on conflict (idempotency_key) do nothing`,
      [createId('furem'), followUp.id, channel, followUp.assignedTo || null, scheduledAt, key, JSON.stringify({ minutesBefore })]
    );
  }
}

async function syncLeadNextAction(db, followUp) {
  const leadId = followUp.leadId || (normalizeEntityType(followUp.relatedEntityType) === 'Lead' ? followUp.relatedEntityId : null);
  if (!leadId) return;
  const parts = dateTimeParts(followUp.dueAt, followUp.timezone);
  await db.query(
    `update leads set follow_up_date = $2, next_follow_up_time = $3, follow_up_mode = $4,
       follow_up_note = $5, follow_up_priority = $6, assigned_to = coalesce($7, assigned_to), updated_at = now()
     where id = $1`,
    [leadId, parts.date || null, parts.time || '', followUp.followUpType, followUp.description || followUp.internalNote || '', followUp.priority, followUp.assignedTo]
  );
}

async function findDuplicate(db, data, excludeId = null) {
  const result = await db.query(
    `select id, follow_up_number, title, due_at from follow_ups
     where related_entity_type = $1 and related_entity_id = $2 and lower(coalesce(purpose, '')) = lower($3)
       and status = any($4::text[]) and deleted_at is null and ($5::text is null or id <> $5)
       and due_at between $6::timestamptz - interval '24 hours' and $6::timestamptz + interval '24 hours'
     order by due_at asc limit 3`,
    [data.relatedEntityType, data.relatedEntityId, data.purpose || '', ACTIVE_FOLLOW_UP_STATUSES, excludeId, data.dueAt]
  );
  return result.rows;
}

async function createFollowUp(input = {}, actor = null, options = {}) {
  const work = async (db) => {
    const settings = await getSettings(db);
    const entityType = normalizeEntityType(input.relatedEntityType);
    if (!options.system) assertRelatedPermission(actor, entityType);
    const context = await findRelatedEntity(entityType, input.relatedEntityId, db);
    if (!context) throw validationError({ relatedEntityId: 'Related record was not found' });
    const data = normalizeFollowUpInput(input, context, settings);
    data.assignedTo = data.assignedTo || actor?.id || null;
    await assertActiveAssignee(data.assignedTo, db);
    const duplicateWarnings = await findDuplicate(db, data);
    const workloadResult = data.assignedTo ? await db.query(
      `select count(*)::int as count from follow_ups where assigned_to = $1 and due_at::date = $2::timestamptz::date
       and status = any($3::text[]) and deleted_at is null`,
      [data.assignedTo, data.dueAt, ACTIVE_FOLLOW_UP_STATUSES]
    ) : { rows: [{ count: 0 }] };
    const id = input.id || createId('follow-up');
    const followUpNumber = input.followUpNumber || `FU-${dateTimeParts(data.dueAt, data.timezone).date.replace(/-/g, '')}-${id.slice(-6).toUpperCase()}`;
    const record = await followUpModel.create({
      ...data,
      id,
      followUpNumber,
      createdBy: actor?.id || input.createdBy || null,
      updatedBy: actor?.id || input.updatedBy || null,
      rescheduleCount: 0,
      snoozeCount: 0,
      escalationLevel: 0,
      notificationDeliveryStatus: 'pending',
      version: 1
    }, db);
    await recordStatus(db, record.id, null, record.status, actor?.id || null, 'Follow-up created', { source: record.source });
    await recordAudit(db, record.id, 'created', actor?.id || null, {}, record);
    await scheduleReminders(db, record, input.reminderSettings, settings);
    await syncLeadNextAction(db, record);
    await createTimelineEvent(db, record, actor?.id || null, 'follow_up_created', `Follow-up scheduled for ${record.dueAt}`);
    return {
      record,
      warnings: {
        duplicates: duplicateWarnings,
        workload: Number(workloadResult.rows[0]?.count || 0) >= Number(settings.protectionThresholds?.dailyWorkloadWarning || 12)
          ? `Assignee already has ${workloadResult.rows[0].count} follow-ups on this date`
          : ''
      }
    };
  };
  return options.db ? work(options.db) : withTransaction(work);
}

function hydrateJoinedRow(row) {
  const record = followUpModel.hydrateRow(row);
  if (!record) return null;
  record.assigneeName = row.assignee_name || '';
  record.backupAssigneeName = row.backup_assignee_name || '';
  record.relatedPhone = row.related_phone || '';
  record.relatedEmail = row.related_email || '';
  record.companyName = row.company_name || '';
  record.businessValue = Number(row.business_value || 0);
  record.relatedStatus = row.related_status || '';
  record.leadStage = row.lead_stage || record.leadStageAtCreation || '';
  record.lastActivityAt = row.last_activity_at || record.updatedAt;
  record.effectiveStatus = calculateEffectiveStatus(record, new Date(), record.timezone);
  record.overdueDurationSeconds = calculateOverdueSeconds(record);
  return record;
}

function buildFollowUpWhere(filters = {}, user = null) {
  const values = [];
  const clauses = ['f.deleted_at is null', buildAccessClause(user, values)];
  const add = (sql, value) => { values.push(value); clauses.push(sql.replace('?', `$${values.length}`)); };
  const activeStatusesSql = `array[${ACTIVE_FOLLOW_UP_STATUSES.map((_, index) => `'${ACTIVE_FOLLOW_UP_STATUSES[index].replace(/'/g, "''")}'`).join(',')}]`;

  if (filters.status) add('f.status = ?', filters.status);
  if (filters.priority) add('f.priority = ?', filters.priority);
  if (filters.followUpType || filters.type) add('f.follow_up_type = ?', filters.followUpType || filters.type);
  if (filters.assignedTo) add('f.assigned_to = ?', filters.assignedTo);
  if (filters.assignedTeam) add('f.assigned_team = ?', filters.assignedTeam);
  if (filters.relatedEntityType) add('f.related_entity_type = ?', normalizeEntityType(filters.relatedEntityType));
  if (filters.relatedEntityId) add('f.related_entity_id = ?', filters.relatedEntityId);
  if (filters.sequenceId) add('f.sequence_id = ?', filters.sequenceId);
  if (filters.outcome) add('f.actual_outcome = ?', filters.outcome);
  if (filters.from) add('f.due_at >= ?::timestamptz', filters.from);
  if (filters.to) add('f.due_at <= ?::timestamptz', filters.to);

  // Quick Filter Tabs support
  const quick = String(filters.quickFilter || filters.tabFilter || '').toLowerCase();
  if (quick === 'overdue' || String(filters.overdue || '').toLowerCase() === 'true') {
    clauses.push(`f.due_at < now() and f.status = any(${activeStatusesSql})`);
  } else if (quick === 'due_today' || quick === 'today') {
    clauses.push(`f.due_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') and f.due_at < ((date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day') at time zone 'Asia/Kolkata') and f.status = any(${activeStatusesSql})`);
  } else if (quick === 'critical') {
    clauses.push(`f.priority = 'Critical' and f.status = any(${activeStatusesSql})`);
  } else if (quick === 'missing_next_action' || String(filters.missingNextAction || '').toLowerCase() === 'true') {
    clauses.push(`(coalesce(f.next_action, '') = '' or f.next_action is null) and f.status = any(${activeStatusesSql})`);
  } else if (quick === 'upcoming') {
    clauses.push(`f.due_at >= ((date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day') at time zone 'Asia/Kolkata') and f.status = any(${activeStatusesSql})`);
  }

  if (filters.search) {
    values.push(`%${String(filters.search).trim().toLowerCase()}%`);
    clauses.push(`(lower(f.follow_up_number) like $${values.length} or lower(f.title) like $${values.length} or lower(coalesce(f.related_entity_label, '')) like $${values.length} or lower(coalesce(f.description, '')) like $${values.length})`);
  }
  return { values, where: clauses.join(' and ') };
}

async function listFollowUps(filters = {}, user = null) {
  const { values, where } = buildFollowUpWhere(filters, user);
  const sortMap = { dueAt: 'f.due_at', priority: `array_position(array['Low','Medium','High','Critical'], f.priority)`, createdAt: 'f.created_at', status: 'f.status' };
  const sort = sortMap[filters.sortBy] || 'f.due_at';
  const direction = String(filters.sortDirection || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
  const limit = Math.min(200, Math.max(1, Number(filters.limit || 50)));
  const offset = Math.max(0, Number(filters.offset || ((Number(filters.page || 1) - 1) * limit)));
  const countResult = await query(`select count(*)::int as count from follow_ups f where ${where}`, values);
  values.push(limit, offset);
  const rows = await query(
    `select f.*, u.full_name as assignee_name, bu.full_name as backup_assignee_name,
       coalesce(l.phone, ql.phone, c.mobile, '') as related_phone,
       coalesce(l.email, ql.email, c.email, '') as related_email,
       coalesce(l.company_name, ql.company_name, c.company_name, c.name, '') as company_name,
       coalesce(l.value, ql.value, i.total_amount, p.value, r.renewal_price, r.client_charge, 0) as business_value,
       coalesce(l.status, ql.status, i.status, p.status, r.status, '') as related_status,
       coalesce(l.status, ql.status, f.lead_stage_at_creation, '') as lead_stage,
       greatest(f.updated_at, coalesce(l.updated_at, f.updated_at), coalesce(ql.updated_at, f.updated_at), coalesce(c.updated_at, f.updated_at), coalesce(i.updated_at, f.updated_at), coalesce(p.updated_at, f.updated_at), coalesce(r.updated_at, f.updated_at)) as last_activity_at
     from follow_ups f
     left join users u on u.id = f.assigned_to left join users bu on bu.id = f.backup_assignee
     left join leads l on f.related_entity_type in ('Lead','Opportunity','Deal') and l.id=f.related_entity_id
     left join lead_events qe on f.related_entity_type in ('Quotation','Proposal') and qe.id=f.related_entity_id
     left join leads ql on ql.id=qe.lead_id
     left join clients c on c.id=coalesce(f.client_id, case when f.related_entity_type='Client' then f.related_entity_id end)
     left join invoices i on i.id=coalesce(f.invoice_id, case when f.related_entity_type='Invoice' then f.related_entity_id end)
     left join projects p on p.id=coalesce(f.project_id, case when f.related_entity_type='Project' then f.related_entity_id end)
     left join renewals r on r.id=coalesce(f.renewal_id, case when f.related_entity_type='Renewal' then f.related_entity_id end)
     where ${where} order by ${sort} ${direction}, f.created_at desc limit $${values.length - 1} offset $${values.length}`,
    values
  );
  return { rows: rows.rows.map(hydrateJoinedRow), total: Number(countResult.rows[0]?.count || 0), limit, offset };
}

async function getFollowUp(id, user = null, { includeHistory = true } = {}) {
  const values = [id];
  const access = buildAccessClause(user, values);
  const result = await query(
    `select f.*, u.full_name as assignee_name, bu.full_name as backup_assignee_name,
       coalesce(l.phone, ql.phone, c.mobile, '') as related_phone,
       coalesce(l.email, ql.email, c.email, '') as related_email,
       coalesce(l.company_name, ql.company_name, c.company_name, c.name, '') as company_name,
       coalesce(l.value, ql.value, i.total_amount, p.value, r.renewal_price, r.client_charge, 0) as business_value,
       coalesce(l.status, ql.status, i.status, p.status, r.status, '') as related_status,
       coalesce(l.status, ql.status, f.lead_stage_at_creation, '') as lead_stage,
       greatest(f.updated_at, coalesce(l.updated_at, f.updated_at), coalesce(ql.updated_at, f.updated_at), coalesce(c.updated_at, f.updated_at), coalesce(i.updated_at, f.updated_at), coalesce(p.updated_at, f.updated_at), coalesce(r.updated_at, f.updated_at)) as last_activity_at
     from follow_ups f
     left join users u on u.id = f.assigned_to left join users bu on bu.id = f.backup_assignee
     left join leads l on f.related_entity_type in ('Lead','Opportunity','Deal') and l.id=f.related_entity_id
     left join lead_events qe on f.related_entity_type in ('Quotation','Proposal') and qe.id=f.related_entity_id
     left join leads ql on ql.id=qe.lead_id
     left join clients c on c.id=coalesce(f.client_id, case when f.related_entity_type='Client' then f.related_entity_id end)
     left join invoices i on i.id=coalesce(f.invoice_id, case when f.related_entity_type='Invoice' then f.related_entity_id end)
     left join projects p on p.id=coalesce(f.project_id, case when f.related_entity_type='Project' then f.related_entity_id end)
     left join renewals r on r.id=coalesce(f.renewal_id, case when f.related_entity_type='Renewal' then f.related_entity_id end)
     where f.id = $1 and f.deleted_at is null and ${access} limit 1`,
    values
  );
  const record = hydrateJoinedRow(result.rows[0]);
  if (!record || !includeHistory) return record;
  const [statuses, reschedules, escalations, reminders, audits] = await Promise.all([
    query('select * from follow_up_status_history where follow_up_id = $1 order by created_at desc', [id]),
    query('select * from follow_up_reschedule_history where follow_up_id = $1 order by created_at desc', [id]),
    query('select * from follow_up_escalation_logs where follow_up_id = $1 order by created_at desc', [id]),
    query('select * from follow_up_reminders where follow_up_id = $1 order by scheduled_at asc', [id]),
    hasPermission(user, 'followups.view_audit') || user?.isSuperAdmin
      ? query('select * from follow_up_audit_logs where follow_up_id = $1 order by created_at desc', [id])
      : Promise.resolve({ rows: [] })
  ]);
  return { ...record, statusHistory: statuses.rows, rescheduleHistory: reschedules.rows, escalationHistory: escalations.rows, reminders: reminders.rows, auditLogs: audits.rows };
}

async function updateFollowUp(id, patch = {}, actor = null, expectedVersion = null) {
  return withTransaction(async (db) => {
    const current = await followUpModel.findById(id, db);
    if (!current || current.deletedAt) return null;
    assertCanMutate(current, actor, 'edit');
    if (expectedVersion != null && Number(current.version) !== Number(expectedVersion)) {
      const error = new Error('This follow-up was updated by someone else. Refresh and try again.');
      error.statusCode = 409;
      throw error;
    }
    const settings = await getSettings(db);
    const dueAt = patch.dueAt || patch.date ? parseDateTime(patch.dueAt, patch.date, patch.time, patch.timezone || current.timezone) : current.dueAt;
    if (!dueAt) throw validationError({ dueAt: 'Enter a valid due date and time' });
    if (patch.assignedTo !== undefined) await assertActiveAssignee(patch.assignedTo, db);
    const allowed = {
      title: patch.title, description: patch.description, followUpType: patch.followUpType, purpose: patch.purpose,
      scheduledAt: patch.scheduledAt || dueAt, dueAt, timezone: patch.timezone, expectedDurationMinutes: patch.expectedDurationMinutes,
      priority: patch.priority, priorityReason: patch.priorityReason, status: patch.status, expectedOutcome: patch.expectedOutcome,
      nextAction: patch.nextAction, internalNote: patch.internalNote, customerVisibleNote: patch.customerVisibleNote,
      tags: patch.tags, location: patch.location, attachments: patch.attachments, assignedTo: patch.assignedTo,
      assignedTeam: patch.assignedTeam, backupAssignee: patch.backupAssignee, templateId: patch.templateId,
      escalationRuleId: patch.escalationRuleId, isRecurring: patch.isRecurring, recurrenceRule: patch.recurrenceRule,
      updatedBy: actor?.id || null, version: Number(current.version || 1) + 1
    };
    Object.keys(allowed).forEach((key) => allowed[key] === undefined && delete allowed[key]);
    const updated = await followUpModel.update(id, allowed, db);
    if (current.status !== updated.status) await recordStatus(db, id, current.status, updated.status, actor?.id, 'Follow-up edited');
    await recordAudit(db, id, 'updated', actor?.id, current, updated);
    if (String(current.dueAt) !== String(updated.dueAt)) {
      await db.query(`update follow_up_reminders set status='cancelled', updated_at=now() where follow_up_id=$1 and status in ('pending','retry')`, [id]);
      await scheduleReminders(db, updated, patch.reminderSettings, settings);
    }
    await syncLeadNextAction(db, updated);
    return updated;
  });
}

async function markInProgress(id, actor) {
  return withTransaction(async (db) => {
    const current = await followUpModel.findById(id, db);
    if (!current || current.deletedAt) return null;
    assertCanMutate(current, actor, 'complete');
    const updated = await followUpModel.update(id, { status: 'In Progress', updatedBy: actor?.id, version: Number(current.version || 1) + 1 }, db);
    await recordStatus(db, id, current.status, 'In Progress', actor?.id, 'Work started');
    await recordAudit(db, id, 'started', actor?.id, { status: current.status }, { status: 'In Progress' });
    return updated;
  });
}

function isTerminalRelatedStatus(type, status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (['lead', 'opportunity', 'deal'].includes(String(type || '').toLowerCase())) return ['won', 'lost', 'not interested', 'invalid lead', 'duplicate'].includes(normalized);
  if (String(type).toLowerCase() === 'invoice') return ['paid', 'cancelled', 'void'].includes(normalized);
  if (String(type).toLowerCase() === 'project') return ['completed', 'closed', 'cancelled'].includes(normalized);
  if (String(type).toLowerCase() === 'renewal') return ['renewed', 'completed', 'cancelled'].includes(normalized);
  if (String(type).toLowerCase().includes('ticket')) return ['resolved', 'closed', 'cancelled'].includes(normalized);
  return ['inactive', 'declined', 'cancelled', 'closed'].includes(normalized);
}

async function completeFollowUp(id, payload = {}, actor = null, options = {}) {
  const work = async (db) => {
    const locked = await db.query('select * from follow_ups where id = $1 and deleted_at is null for update', [id]);
    const current = followUpModel.hydrateRow(locked.rows[0]);
    if (!current) return null;
    assertCanMutate(current, actor, 'complete');
    if (CLOSED_FOLLOW_UP_STATUSES.includes(current.status)) throw validationError({ status: 'Follow-up is already closed' });
    const errors = {};
    const actualOutcome = String(payload.actualOutcome || '').trim();
    const communicationResult = String(payload.communicationResult || actualOutcome || '').trim();
    const discussionNote = String(payload.discussionNote || '').trim();
    if (!actualOutcome) errors.actualOutcome = 'Actual outcome is required';
    if (!communicationResult) errors.communicationResult = 'Communication result is required';
    if (!discussionNote) errors.discussionNote = 'Discussion note is required';
    if (actualOutcome && !OUTCOMES.includes(actualOutcome) && actualOutcome !== 'Custom') errors.actualOutcome = 'Select a valid outcome';
    const related = await findRelatedEntity(current.relatedEntityType, current.relatedEntityId, db);
    const relatedStatus = payload.relatedStatus || related?.status || '';
    const terminal = isTerminalRelatedStatus(current.relatedEntityType, relatedStatus);
    const settings = await getSettings(db);
    const recurringAt = current.isRecurring ? getNextRecurrenceAt(current.dueAt, current.recurrenceRule, settings) : null;
    const nextFollowUpAt = parseDateTime(payload.nextFollowUpAt || recurringAt, payload.nextFollowUpDate, payload.nextFollowUpTime, current.timezone);
    const nextAction = String(payload.nextAction || '').trim();
    const closureReason = String(payload.noNextFollowUpReason || '').trim();
    const canOverride = actor?.isSuperAdmin || hasPermission(actor, 'followups.override_next_action');
    const nextActionRequired = !terminal && !canOverride;
    if (nextActionRequired) {
      if (!nextAction) errors.nextAction = 'Next action is required for an active record';
      if (!nextFollowUpAt) errors.nextFollowUpAt = 'Next follow-up date and time are required for an active record';
    }
    if (!nextFollowUpAt && !closureReason) errors.noNextFollowUpReason = 'Reason is required when no next follow-up is created';
    if (Object.keys(errors).length) throw validationError(errors);

    const completedAt = new Date().toISOString();
    const completed = await followUpModel.update(id, {
      status: 'Completed', actualOutcome, communicationResult, discussionNote,
      nextAction, nextFollowUpAt, noNextFollowUpReason: closureReason,
      completedAt, completedBy: actor?.id || null, updatedBy: actor?.id || null,
      attachments: [...(current.attachments || []), ...(Array.isArray(payload.attachments) ? payload.attachments : [])],
      version: Number(current.version || 1) + 1
    }, db);
    await recordStatus(db, id, current.status, 'Completed', actor?.id, actualOutcome, { communicationResult });
    await recordAudit(db, id, 'completed', actor?.id, current, completed, { callRecordingReference: payload.callRecordingReference || '' });

    if (payload.relatedStatus && related && ENTITY_DEFINITIONS[normalizeEntityType(current.relatedEntityType)]) {
      const definition = ENTITY_DEFINITIONS[normalizeEntityType(current.relatedEntityType)];
      if (definition.status && !definition.status.includes('payload')) {
        await db.query(`update ${definition.table} set ${definition.status} = $2, updated_at = now() where id = $1`, [current.relatedEntityId, payload.relatedStatus]);
      }
    }

    let next = null;
    if (nextFollowUpAt) {
      const created = await createFollowUp({
        relatedEntityType: current.relatedEntityType,
        relatedEntityId: current.relatedEntityId,
        relatedEntityLabel: current.relatedEntityLabel,
        leadId: current.leadId, clientId: current.clientId, projectId: current.projectId,
        invoiceId: current.invoiceId, renewalId: current.renewalId,
        title: payload.nextTitle || nextAction || current.title,
        description: payload.nextDescription || '',
        followUpType: payload.nextFollowUpType || current.followUpType,
        purpose: payload.nextPurpose || current.purpose,
        dueAt: nextFollowUpAt,
        timezone: current.timezone,
        expectedDurationMinutes: current.expectedDurationMinutes,
        priority: payload.nextPriority || current.priority,
        assignedTo: payload.nextAssignedTo || current.assignedTo,
        assignedTeam: current.assignedTeam,
        backupAssignee: current.backupAssignee,
        source: current.isRecurring ? 'recurrence' : 'completion',
        isAutomatic: current.isRecurring,
        isRecurring: current.isRecurring,
        recurrenceRule: current.recurrenceRule,
        parentFollowUpId: current.parentFollowUpId || (current.isRecurring ? current.id : null),
        previousFollowUpId: current.id,
        sequenceId: current.sequenceId,
        templateId: current.templateId,
        escalationRuleId: current.escalationRuleId,
        expectedOutcome: current.expectedOutcome,
        nextAction: payload.nextAction
      }, actor, { db, system: options.system });
      next = created.record;
    } else if (current.leadId || normalizeEntityType(current.relatedEntityType) === 'Lead') {
      const targetLeadId = current.leadId || current.relatedEntityId;
      await db.query(`update leads set follow_up_date = null, next_follow_up_time = '', follow_up_note = $2, updated_at = now() where id = $1`, [targetLeadId, closureReason || actualOutcome]);
    }
    await createTimelineEvent(db, completed, actor?.id, 'follow_up_completed', discussionNote, { actualOutcome, nextFollowUpId: next?.id || null, nextAction });
    if (current.sequenceId && terminal) {
      await db.query(
        `update follow_up_sequence_enrollments set status = 'Completed', stopped_by = $3, stop_reason = $4, updated_at = now()
         where sequence_id = $1 and related_entity_id = $2 and status = 'Active'`,
        [current.sequenceId, current.relatedEntityId, actor?.id || null, `Exit condition: ${relatedStatus}`]
      );
    }
    return { followUp: completed, nextFollowUp: next };
  };
  return options.db ? work(options.db) : withTransaction(work);
}

async function rescheduleFollowUp(id, payload = {}, actor = null, actionType = 'reschedule', options = {}) {
  const work = async (db) => {
    const current = await followUpModel.findById(id, db);
    if (!current || current.deletedAt) return null;
    assertCanMutate(current, actor, actionType === 'snooze' ? 'reschedule' : 'reschedule');
    const reason = String(payload.reason || '').trim();
    if (!reason) throw validationError({ reason: `${actionType === 'snooze' ? 'Snooze' : 'Reschedule'} reason is required` });
    const settings = await getSettings(db);
    let dueAt = parseDateTime(payload.dueAt, payload.date || payload.followUpDate, payload.time || payload.nextFollowUpTime, current.timezone);
    if (actionType === 'snooze' && !dueAt) dueAt = new Date(Date.now() + Math.max(5, Number(payload.minutes || 30)) * 60000).toISOString();
    if (!dueAt || new Date(dueAt) <= new Date()) throw validationError({ dueAt: 'New due date must be in the future' });
    const maxCritical = Number(settings.protectionThresholds?.maxCriticalSnoozes ?? 1);
    const maxReschedules = Number(settings.protectionThresholds?.maxReschedules ?? 3);
    if (actionType === 'snooze' && current.priority === 'Critical' && Number(current.snoozeCount || 0) >= maxCritical && !(actor?.isSuperAdmin || hasPermission(actor, 'followups.edit_any'))) {
      throw forbidden('Critical follow-up snooze limit reached; manager approval is required');
    }
    if (actionType === 'reschedule' && Number(current.rescheduleCount || 0) >= maxReschedules && !(actor?.isSuperAdmin || hasPermission(actor, 'followups.edit_any'))) {
      throw forbidden('Reschedule limit reached; manager approval is required');
    }
    const nextStatus = actionType === 'snooze' ? 'Snoozed' : 'Rescheduled';
    const updated = await followUpModel.update(id, {
      dueAt, scheduledAt: dueAt, status: nextStatus,
      rescheduleCount: Number(current.rescheduleCount || 0) + (actionType === 'reschedule' ? 1 : 0),
      snoozeCount: Number(current.snoozeCount || 0) + (actionType === 'snooze' ? 1 : 0),
      lastRescheduleReason: reason, updatedBy: actor?.id || null, version: Number(current.version || 1) + 1
    }, db);
    await db.query(
      `insert into follow_up_reschedule_history (id, follow_up_id, previous_due_at, next_due_at, reason, note, action_type, changed_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [createId('fureschedule'), id, current.dueAt, dueAt, reason, String(payload.note || ''), actionType, actor?.id || null]
    );
    await recordStatus(db, id, current.status, nextStatus, actor?.id, reason);
    await recordAudit(db, id, actionType, actor?.id, { dueAt: current.dueAt, status: current.status }, { dueAt, status: nextStatus }, { reason, note: payload.note || '' });
    await db.query(`update follow_up_reminders set status='cancelled', updated_at=now() where follow_up_id=$1 and status in ('pending','retry')`, [id]);
    await scheduleReminders(db, updated, payload.reminderSettings, settings);
    await syncLeadNextAction(db, updated);
    await createTimelineEvent(db, updated, actor?.id, actionType === 'snooze' ? 'follow_up_snoozed' : 'follow_up_rescheduled', reason, { previousDueAt: current.dueAt });
    return updated;
  };
  return options.db ? work(options.db) : withTransaction(work);
}

async function reassignFollowUp(id, payload = {}, actor = null, options = {}) {
  const work = async (db) => {
    const current = await followUpModel.findById(id, db);
    if (!current || current.deletedAt) return null;
    if (!(actor?.isSuperAdmin || hasPermission(actor, 'followups.reassign') || String(current.createdBy) === String(actor?.id))) throw forbidden();
    if (!payload.assignedTo) throw validationError({ assignedTo: 'Assignee is required' });
    await assertActiveAssignee(payload.assignedTo, db);
    const updated = await followUpModel.update(id, { assignedTo: payload.assignedTo, assignedTeam: payload.assignedTeam ?? current.assignedTeam, updatedBy: actor?.id, version: Number(current.version || 1) + 1 }, db);
    await recordAudit(db, id, 'reassigned', actor?.id, { assignedTo: current.assignedTo, assignedTeam: current.assignedTeam }, { assignedTo: updated.assignedTo, assignedTeam: updated.assignedTeam }, { reason: payload.reason || '' });
    await createTimelineEvent(db, updated, actor?.id, 'follow_up_reassigned', payload.reason || 'Assignment changed', { previousAssigneeId: current.assignedTo });
    return updated;
  };
  return options.db ? work(options.db) : withTransaction(work);
}

async function escalateFollowUp(id, payload = {}, actor = null, options = {}) {
  const work = async (db) => {
    const current = await followUpModel.findById(id, db);
    if (!current || current.deletedAt) return null;
    if (!options.system && !(actor?.isSuperAdmin || hasPermission(actor, 'followups.escalate'))) throw forbidden();
    const level = Math.max(Number(current.escalationLevel || 0) + 1, Number(payload.level || 1));
    const priority = level >= 3 ? 'Critical' : PRIORITIES[Math.min(3, Math.max(PRIORITIES.indexOf(current.priority), 2))];
    const updated = await followUpModel.update(id, {
      status: 'Escalated', priority, priorityReason: payload.reason || `Escalation level ${level}`,
      escalationLevel: level, escalatedTo: payload.escalatedTo || current.escalatedTo,
      lastEscalationAt: new Date().toISOString(), updatedBy: actor?.id || null, version: Number(current.version || 1) + 1
    }, db);
    await db.query(
      `insert into follow_up_escalation_logs (id, follow_up_id, rule_id, escalation_level, action, escalated_from, escalated_to, reason, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [createId('fuescalation'), id, current.escalationRuleId || null, level, payload.action || 'notify', current.assignedTo || null, payload.escalatedTo || null, payload.reason || `Overdue escalation level ${level}`, JSON.stringify(payload.metadata || {})]
    );
    await recordStatus(db, id, current.status, 'Escalated', actor?.id, payload.reason || 'Escalated', { level });
    await recordAudit(db, id, 'escalated', actor?.id, { escalationLevel: current.escalationLevel, priority: current.priority }, { escalationLevel: level, priority });
    return updated;
  };
  return options.db ? work(options.db) : withTransaction(work);
}

async function acknowledgeReminder(id, actor = null) {
  return withTransaction(async (db) => {
    const current = await followUpModel.findById(id, db);
    if (!current || current.deletedAt) return null;
    assertCanMutate(current, actor, 'edit');
    const at = new Date().toISOString();
    const updated = await followUpModel.update(id, { reminderAcknowledged: true, reminderAcknowledgedAt: at, updatedBy: actor?.id }, db);
    await db.query(`update follow_up_reminders set acknowledged_at = $2, updated_at = now() where follow_up_id = $1 and acknowledged_at is null`, [id, at]);
    await recordAudit(db, id, 'reminder_acknowledged', actor?.id, {}, { acknowledgedAt: at });
    return updated;
  });
}

async function softDeleteFollowUp(id, actor = null) {
  return withTransaction(async (db) => {
    const current = await followUpModel.findById(id, db);
    if (!current || current.deletedAt) return null;
    if (!(actor?.isSuperAdmin || hasPermission(actor, 'followups.delete'))) throw forbidden();
    const deletedAt = new Date().toISOString();
    const updated = await followUpModel.update(id, { deletedAt, updatedBy: actor?.id, version: Number(current.version || 1) + 1 }, db);
    await recordAudit(db, id, 'deleted', actor?.id, current, { deletedAt });
    return updated;
  });
}

async function restoreFollowUp(id, actor = null) {
  return withTransaction(async (db) => {
    const current = await followUpModel.findById(id, db);
    if (!current || !current.deletedAt) return current || null;
    if (!(actor?.isSuperAdmin || hasPermission(actor, 'followups.restore'))) throw forbidden();
    const updated = await followUpModel.update(id, { deletedAt: null, updatedBy: actor?.id, version: Number(current.version || 1) + 1 }, db);
    await recordAudit(db, id, 'restored', actor?.id, { deletedAt: current.deletedAt }, { deletedAt: null });
    return updated;
  });
}

async function getCommandCenter(user = null, dateValue = null) {
  const settings = await getSettings();
  const date = dateValue || dateTimeParts(new Date(), settings.timezone).date;
  const endDate = new Date(`${date}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  const from = parseDateTime('', date, '00:00', settings.timezone);
  const to = parseDateTime('', endDate.toISOString().slice(0, 10), '23:59', settings.timezone);
  const result = await listFollowUps({ from, to, limit: 200 }, user);
  const overdue = await listFollowUps({ overdue: true, limit: 200 }, user);
  const all = [...overdue.rows, ...result.rows.filter((row) => !overdue.rows.some((item) => item.id === row.id))];
  const now = Date.now();
  const sections = {
    overdue: all.filter((row) => row.effectiveStatus === 'Overdue'),
    dueNow: all.filter((row) => Math.abs(new Date(row.dueAt).getTime() - now) <= 30 * 60000 && row.effectiveStatus !== 'Overdue'),
    dueToday: all.filter((row) => dateTimeParts(row.dueAt, settings.timezone).date === date && row.effectiveStatus !== 'Overdue'),
    upcoming: all.filter((row) => new Date(row.dueAt).getTime() > now + 30 * 60000),
    highPriority: all.filter((row) => row.priority === 'High'),
    critical: all.filter((row) => row.priority === 'Critical'),
    waitingForClient: all.filter((row) => row.status === 'Waiting for Client'),
    waitingForInternalTeam: all.filter((row) => row.status === 'Waiting for Internal Team'),
    rescheduled: all.filter((row) => row.status === 'Rescheduled'),
    unassigned: all.filter((row) => !row.assignedTo),
    noResponse: all.filter((row) => row.status === 'No Response'),
    missingNextAction: all.filter((row) => !row.nextAction)
  };
  return { date, timezone: settings.timezone, counts: Object.fromEntries(Object.entries(sections).map(([key, rows]) => [key, rows.length])), sections };
}

async function getAttentionRequired(user = null) {
  const settings = await getSettings();
  const thresholds = settings.protectionThresholds || {};
  const accessValues = [];
  const access = buildAccessClause(user, accessValues);
  const followUpRisks = await query(
    `select f.*, u.full_name as assignee_name from follow_ups f left join users u on u.id = f.assigned_to
     where f.deleted_at is null and f.status = any($${accessValues.length + 1}::text[]) and ${access}`,
    [...accessValues, ACTIVE_FOLLOW_UP_STATUSES]
  );
  const allowedAll = canViewAll(user);
  const ownUserId = user?.id || '';
  const [missingLeads, quotations, invoices, renewals, promises] = await Promise.all([
    query(
      `select l.id, coalesce(l.contact_person, l.company_name, l.name, l.lead_number) as label, l.assigned_to, l.value, l.status, l.updated_at
       from leads l where l.status not in ('Won','Lost','Not Interested','Invalid Lead','Duplicate')
       and not exists (select 1 from follow_ups f where f.related_entity_type in ('Lead','Opportunity','Deal') and f.related_entity_id = l.id and f.status = any($1::text[]) and f.deleted_at is null)
       and ($2::boolean = true or l.assigned_to = $3) order by l.updated_at asc limit 100`,
      [ACTIVE_FOLLOW_UP_STATUSES, allowedAll, ownUserId]
    ),
    query(
      `select e.id, e.title as label, e.owner_user_id as assigned_to, e.updated_at, coalesce(e.payload->>'status','') as status
       from lead_events e where e.event_type = 'quotation' and lower(coalesce(e.payload->>'status','')) in ('sent','viewed','under review','revision requested')
       and not exists (select 1 from follow_ups f where f.related_entity_type = 'Quotation' and f.related_entity_id = e.id and f.status = any($1::text[]) and f.deleted_at is null)
       and ($2::boolean = true or e.owner_user_id = $3) order by e.updated_at asc limit 100`,
      [ACTIVE_FOLLOW_UP_STATUSES, allowedAll, ownUserId]
    ),
    query(
      `select i.id, i.invoice_number as label, i.due_date, i.status, i.total_amount,
        greatest(i.total_amount - coalesce(sum(p.amount_received + p.tds_deducted),0),0) as outstanding
       from invoices i left join payments p on p.invoice_id = i.id left join clients c on c.id=i.client_id
       where lower(i.status) not in ('paid','cancelled','void') and ($2::boolean=true or c.assigned_to=$3)
       group by i.id having greatest(i.total_amount - coalesce(sum(p.amount_received + p.tds_deducted),0),0) > 0
       and not exists (select 1 from follow_ups f where f.related_entity_type = 'Invoice' and f.related_entity_id = i.id and f.status = any($1::text[]) and f.deleted_at is null)
       order by i.due_date asc nulls last limit 100`,
      [ACTIVE_FOLLOW_UP_STATUSES, allowedAll, ownUserId]
    ),
    query(
      `select r.id, coalesce(r.domain_name,r.hosting_name,r.package_name,r.software_name,r.category) as label, coalesce(r.renewal_date,r.expiry_date,r.reminder_date) as due_date, r.status
       from renewals r left join clients c on c.id=r.client_id where lower(r.status) not in ('renewed','cancelled') and coalesce(r.renewal_date,r.expiry_date,r.reminder_date) <= current_date + $4::int
       and ($2::boolean=true or c.assigned_to=$3)
       and not exists (select 1 from follow_ups f where f.related_entity_type = 'Renewal' and f.related_entity_id = r.id and f.status = any($1::text[]) and f.deleted_at is null)
       order by due_date asc limit 100`,
      [ACTIVE_FOLLOW_UP_STATUSES, allowedAll, ownUserId, Number(thresholds.renewalWindowDays || 90)]
    ),
    query(`select pp.*, i.invoice_number from payment_promises pp join invoices i on i.id = pp.invoice_id left join clients c on c.id=i.client_id where pp.status in ('Pending','Missed') and (pp.missed=true or pp.promise_date < current_date) and ($1::boolean=true or c.assigned_to=$2) order by pp.promise_date asc limit 100`, [allowedAll, ownUserId])
  ]);
  const rows = followUpRisks.rows.map(hydrateJoinedRow);
  const categories = {
    missingNextAction: [
      ...missingLeads.rows.map((row) => ({ category: 'Missing Next Action', entityType: 'Lead', entityId: row.id, ...row })),
      ...quotations.rows.map((row) => ({ category: 'Missing Next Action', entityType: 'Quotation', entityId: row.id, ...row })),
      ...invoices.rows.map((row) => ({ category: 'Missing Next Action', entityType: 'Invoice', entityId: row.id, ...row }))
    ],
    overdue: rows.filter((row) => row.effectiveStatus === 'Overdue'),
    unassigned: rows.filter((row) => !row.assignedTo),
    highValueAtRisk: [
      ...rows.filter((row) => ['High', 'Critical'].includes(row.priority) && row.effectiveStatus === 'Overdue'),
      ...missingLeads.rows.filter((row) => Number(row.value || 0) >= Number(thresholds.highValueLead || 250000)).map((row) => ({ category: 'High-Value At Risk', entityType: 'Lead', entityId: row.id, ...row }))
    ],
    waitingTooLong: rows.filter((row) => ['Waiting for Client', 'Waiting for Internal Team'].includes(row.status) && Date.now() - new Date(row.updatedAt).getTime() > Number(thresholds.waitingHours || 48) * 3600000),
    repeatedlyRescheduled: rows.filter((row) => Number(row.rescheduleCount || 0) >= Number(thresholds.maxReschedules || 3)),
    promiseDateMissed: promises.rows.map((row) => ({ category: 'Promise Date Missed', entityType: 'Invoice', entityId: row.invoice_id, label: row.invoice_number, ...row })),
    renewalRisk: renewals.rows.map((row) => ({ category: 'Renewal Risk', entityType: 'Renewal', entityId: row.id, ...row })),
    assignmentRisk: rows.filter((row) => row.assignedTo && !row.assigneeName)
  };
  return { counts: Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, value.length])), categories };
}

async function getAnalytics(filters = {}, user = null) {
  const { values, where } = buildFollowUpWhere(filters, user);
  const activeStatuses = ACTIVE_FOLLOW_UP_STATUSES.map((status) => `'${status.replace(/'/g, "''")}'`).join(',');
  const overdue = `(f.due_at < now() and f.status in (${activeStatuses}))`;
  const effectiveStatus = `(case when ${overdue} then 'Overdue' else f.status end)`;
  const groupQuery = (expression, joins = '') => query(
    `select coalesce(${expression}, 'Unspecified') as key, count(*)::int as count
     from follow_ups f ${joins} where ${where} group by 1 order by 2 desc, 1 asc`,
    values
  );
  const [summaryResult, statusResult, priorityResult, outcomeResult, typeResult, assigneeResult] = await Promise.all([
    query(
      `select count(*)::int as total,
         count(*) filter (where f.status='Completed')::int as completed,
         count(*) filter (where ${overdue})::int as overdue,
         count(*) filter (where f.priority='Critical')::int as critical,
         count(*) filter (where f.assigned_to is null)::int as unassigned,
         coalesce(avg(extract(epoch from (now()-f.due_at))/3600) filter (where ${overdue}),0) as average_overdue_hours
       from follow_ups f where ${where}`,
      values
    ),
    groupQuery(effectiveStatus),
    groupQuery('f.priority'),
    groupQuery(`nullif(f.actual_outcome, '')`),
    groupQuery('f.follow_up_type'),
    query(
      `select coalesce(u.full_name, 'Unassigned') as key, count(*)::int as total,
         count(*) filter (where f.status='Completed')::int as completed,
         count(*) filter (where ${overdue})::int as overdue
       from follow_ups f left join users u on u.id=f.assigned_to
       where ${where} group by 1 order by 2 desc, 1 asc`,
      values
    )
  ]);
  const summary = summaryResult.rows[0] || {};
  const toGroup = (rows) => Object.fromEntries(rows.map((row) => [row.key, Number(row.count || 0)]));
  const total = Number(summary.total || 0);
  const completed = Number(summary.completed || 0);
  return {
    total,
    completed,
    overdue: Number(summary.overdue || 0),
    critical: Number(summary.critical || 0),
    unassigned: Number(summary.unassigned || 0),
    completionRate: total ? Math.round((completed / total) * 1000) / 10 : 0,
    averageOverdueHours: Math.round(Number(summary.average_overdue_hours || 0) * 10) / 10,
    byStatus: toGroup(statusResult.rows),
    byPriority: toGroup(priorityResult.rows),
    byOutcome: toGroup(outcomeResult.rows),
    byType: toGroup(typeResult.rows),
    byAssignee: Object.fromEntries(assigneeResult.rows.map((row) => [row.key, {
      total: Number(row.total || 0), completed: Number(row.completed || 0), overdue: Number(row.overdue || 0)
    }]))
  };
}

const CONFIG_TABLES = {
  templates: 'follow_up_templates',
  sequences: 'follow_up_sequences',
  automationRules: 'follow_up_automation_rules',
  escalationRules: 'follow_up_escalation_rules'
};

async function listConfig(kind) {
  const table = CONFIG_TABLES[kind];
  if (!table) throw validationError({ kind: 'Unsupported configuration type' });
  const result = await query(`select * from ${table} order by is_active desc, name asc`);
  if (kind !== 'sequences') return result.rows;
  const steps = await query('select * from follow_up_sequence_steps order by sequence_id, step_order');
  return result.rows.map((row) => ({ ...row, steps: steps.rows.filter((step) => step.sequence_id === row.id) }));
}

async function saveConfig(kind, body = {}, actor = null, id = null) {
  const table = CONFIG_TABLES[kind];
  if (!table) throw validationError({ kind: 'Unsupported configuration type' });
  return withTransaction(async (db) => {
    const recordId = id || createId(kind.toLowerCase());
    const common = [recordId, String(body.name || '').trim(), body.isActive !== false, actor?.id || null, JSON.stringify(body.payload || {})];
    if (!common[1]) throw validationError({ name: 'Name is required' });
    if (kind === 'templates') {
      await db.query(
        `insert into follow_up_templates (id,name,category,follow_up_type,default_title,description,default_duration_minutes,default_priority,assignee_strategy,reminder_settings,expected_outcome,next_action_suggestion,escalation_rule_id,message_template,sequence_id,is_active,payload,created_by,updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$18)
         on conflict (id) do update set name=excluded.name,category=excluded.category,follow_up_type=excluded.follow_up_type,default_title=excluded.default_title,description=excluded.description,default_duration_minutes=excluded.default_duration_minutes,default_priority=excluded.default_priority,assignee_strategy=excluded.assignee_strategy,reminder_settings=excluded.reminder_settings,expected_outcome=excluded.expected_outcome,next_action_suggestion=excluded.next_action_suggestion,escalation_rule_id=excluded.escalation_rule_id,message_template=excluded.message_template,sequence_id=excluded.sequence_id,is_active=excluded.is_active,payload=excluded.payload,updated_by=excluded.updated_by,updated_at=now()`,
        [recordId, common[1], body.category || 'General', body.followUpType || 'Call', body.defaultTitle || common[1], body.description || '', Number(body.defaultDurationMinutes || 30), body.defaultPriority || 'Medium', body.assigneeStrategy || 'record_owner', JSON.stringify(body.reminderSettings || []), body.expectedOutcome || '', body.nextActionSuggestion || '', body.escalationRuleId || null, body.messageTemplate || '', body.sequenceId || null, common[2], common[4], common[3]]
      );
    } else if (kind === 'sequences') {
      await db.query(
        `insert into follow_up_sequences (id,name,description,trigger_key,applicable_entity_type,conditions,exit_conditions,pause_rules,retry_rules,version,is_active,payload,created_by,updated_by)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb,$13,$13)
         on conflict (id) do update set name=excluded.name,description=excluded.description,trigger_key=excluded.trigger_key,applicable_entity_type=excluded.applicable_entity_type,conditions=excluded.conditions,exit_conditions=excluded.exit_conditions,pause_rules=excluded.pause_rules,retry_rules=excluded.retry_rules,version=follow_up_sequences.version+1,is_active=excluded.is_active,payload=excluded.payload,updated_by=excluded.updated_by,updated_at=now()`,
        [recordId, common[1], body.description || '', body.triggerKey || 'manual', body.applicableEntityType || 'Custom', JSON.stringify(body.conditions || {}), JSON.stringify(body.exitConditions || []), JSON.stringify(body.pauseRules || {}), JSON.stringify(body.retryRules || {}), Number(body.version || 1), common[2], common[4], common[3]]
      );
      if (Array.isArray(body.steps)) {
        await db.query('delete from follow_up_sequence_steps where sequence_id = $1', [recordId]);
        for (let index = 0; index < body.steps.length; index += 1) {
          const step = body.steps[index];
          await db.query(
            `insert into follow_up_sequence_steps (id,sequence_id,step_order,name,delay_minutes,action_type,follow_up_type,title_template,assignee_strategy,reminder_settings,message_template,conditions,escalation_rule_id,is_active,payload)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13,$14,$15::jsonb)`,
            [step.id || createId('fustep'), recordId, Number(step.stepOrder || index + 1), step.name || `Step ${index + 1}`, Number(step.delayMinutes || 0), step.actionType || 'create_follow_up', step.followUpType || 'Call', step.titleTemplate || common[1], step.assigneeStrategy || 'record_owner', JSON.stringify(step.reminderSettings || []), step.messageTemplate || '', JSON.stringify(step.conditions || {}), step.escalationRuleId || null, step.isActive !== false, JSON.stringify(step.payload || {})]
          );
        }
      }
    } else {
      const trigger = kind === 'automationRules' ? (body.triggerKey || 'manual') : null;
      if (kind === 'automationRules') {
        await db.query(
          `insert into follow_up_automation_rules (id,name,trigger_key,conditions,actions,priority,version,is_active,payload,created_by,updated_by)
           values ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9::jsonb,$10,$10)
           on conflict (id) do update set name=excluded.name,trigger_key=excluded.trigger_key,conditions=excluded.conditions,actions=excluded.actions,priority=excluded.priority,version=follow_up_automation_rules.version+1,is_active=excluded.is_active,payload=excluded.payload,updated_by=excluded.updated_by,updated_at=now()`,
          [recordId, common[1], trigger, JSON.stringify(body.conditions || {}), JSON.stringify(body.actions || []), Number(body.priority || 100), Number(body.version || 1), common[2], common[4], common[3]]
        );
      } else {
        await db.query(
          `insert into follow_up_escalation_rules (id,name,conditions,levels,is_active,payload,created_by,updated_by)
           values ($1,$2,$3::jsonb,$4::jsonb,$5,$6::jsonb,$7,$7)
           on conflict (id) do update set name=excluded.name,conditions=excluded.conditions,levels=excluded.levels,is_active=excluded.is_active,payload=excluded.payload,updated_by=excluded.updated_by,updated_at=now()`,
          [recordId, common[1], JSON.stringify(body.conditions || {}), JSON.stringify(body.levels || []), common[2], common[4], common[3]]
        );
      }
    }
    const result = await db.query(`select * from ${table} where id = $1`, [recordId]);
    await recordAudit(db, null, `${kind}_saved`, actor?.id, {}, result.rows[0] || {}, { recordId });
    return result.rows[0] || null;
  });
}

async function startSequence({ triggerKey, sequenceId = null, relatedEntityType, relatedEntityId, actor = null, db = null, payload = {} }) {
  const work = async (client) => {
    const sequenceResult = await client.query(
      `select * from follow_up_sequences where is_active = true and ${sequenceId ? 'id = $1' : 'trigger_key = $1'} order by version desc limit 1`,
      [sequenceId || triggerKey]
    );
    const sequence = sequenceResult.rows[0];
    if (!sequence) return null;
    const firstStepResult = await client.query('select * from follow_up_sequence_steps where sequence_id = $1 and is_active = true order by step_order asc limit 1', [sequence.id]);
    const firstStep = firstStepResult.rows[0];
    const key = `sequence:${sequence.id}:${normalizeEntityType(relatedEntityType)}:${relatedEntityId}:v${sequence.version}`;
    const nextRunAt = new Date(Date.now() + Number(firstStep?.delay_minutes || 0) * 60000).toISOString();
    const inserted = await client.query(
      `insert into follow_up_sequence_enrollments (id,sequence_id,related_entity_type,related_entity_id,current_step_order,status,next_run_at,started_by,idempotency_key,payload)
       values ($1,$2,$3,$4,0,'Active',$5,$6,$7,$8::jsonb) on conflict (idempotency_key) do nothing returning *`,
      [createId('fuenroll'), sequence.id, normalizeEntityType(relatedEntityType), relatedEntityId, nextRunAt, actor?.id || null, key, JSON.stringify(payload)]
    );
    if (inserted.rows[0]) return inserted.rows[0];
    const existing = await client.query('select * from follow_up_sequence_enrollments where idempotency_key = $1 limit 1', [key]);
    return existing.rows[0] || null;
  };
  return db ? work(db) : withTransaction(work);
}

async function stopSequences(relatedEntityType, relatedEntityId, reason, actor = null, db = null) {
  const exec = db?.query ? db.query.bind(db) : query;
  const result = await exec(
    `update follow_up_sequence_enrollments set status = 'Stopped', stopped_by = $3, stop_reason = $4, updated_at = now()
     where related_entity_type = $1 and related_entity_id = $2 and status = 'Active' returning *`,
    [normalizeEntityType(relatedEntityType), relatedEntityId, actor?.id || null, reason || 'Stopped']
  );
  return result.rows;
}

async function executeAutomationRules(triggerKey, context = {}, actor = null, options = {}) {
  const work = async (db) => {
    const entityType = normalizeEntityType(context.relatedEntityType || context.entityType || 'Custom');
    const entityId = String(context.relatedEntityId || context.entityId || '').trim();
    if (!triggerKey || !entityId) return { executed: 0, skipped: 0, failed: 0, results: [] };
    const rules = await db.query(
      `select * from follow_up_automation_rules where is_active=true and trigger_key=$1 order by priority asc, created_at asc`,
      [triggerKey]
    );
    const related = await findRelatedEntity(entityType, entityId, db);
    const matchRecord = { ...(context.payload || {}), ...context, relatedEntityType: entityType, relatedEntityId: entityId, related };
    const summary = { executed: 0, skipped: 0, failed: 0, results: [] };
    for (const rule of rules.rows) {
      if (!matchesConditions(matchRecord, rule.conditions || {})) {
        summary.skipped += 1;
        continue;
      }
      const eventKey = String(context.eventId || context.idempotencyKey || `${entityType}:${entityId}`);
      const idempotencyKey = `automation:${rule.id}:v${rule.version}:${triggerKey}:${eventKey}`;
      const executionId = createId('fuaexec');
      const inserted = await db.query(
        `insert into follow_up_automation_executions (id,rule_id,trigger_key,related_entity_type,related_entity_id,status,idempotency_key,result)
         values ($1,$2,$3,$4,$5,'Running',$6,'{}'::jsonb) on conflict (idempotency_key) do nothing returning id`,
        [executionId, rule.id, triggerKey, entityType, entityId, idempotencyKey]
      );
      if (!inserted.rows[0]) {
        summary.skipped += 1;
        continue;
      }
      try {
        const outputs = [];
        for (const rawAction of Array.isArray(rule.actions) ? rule.actions : []) {
          const action = rawAction && typeof rawAction === 'object' ? rawAction : { type: rawAction };
          const actionType = String(action.type || action.actionType || action.action || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
          if (actionType === 'create_follow_up') {
            const dueAt = parseDateTime(action.dueAt, action.date, action.time, action.timezone || 'Asia/Kolkata')
              || new Date(Date.now() + Math.max(0, Number(action.delayMinutes ?? 15)) * 60000).toISOString();
            const created = await createFollowUp({
              relatedEntityType: entityType, relatedEntityId: entityId, relatedEntityLabel: related?.label,
              title: action.title || rule.name, description: action.description || '',
              followUpType: action.followUpType || 'Call', purpose: action.purpose || rule.name,
              dueAt, priority: action.priority || 'Medium', assignedTo: action.assignedTo || related?.owner_user_id || actor?.id,
              assignedTeam: action.assignedTeam || '', tags: action.tags || [], templateId: action.templateId || null,
              reminderSettings: action.reminderSettings || [], automationRuleId: rule.id,
              source: 'automation', isAutomatic: true
            }, actor, { db, system: true });
            outputs.push({ action: actionType, followUpId: created.record.id });
          } else if (actionType === 'start_sequence') {
            const enrollment = await startSequence({ triggerKey: action.triggerKey || triggerKey, sequenceId: action.sequenceId || null, relatedEntityType: entityType, relatedEntityId: entityId, actor, db, payload: context.payload || {} });
            outputs.push({ action: actionType, enrollmentId: enrollment?.id || null });
          } else if (actionType === 'stop_sequence' || actionType === 'pause_sequence') {
            const stopped = await stopSequences(entityType, entityId, action.reason || rule.name, actor, db);
            outputs.push({ action: actionType, count: stopped.length });
          } else if (actionType === 'escalate' || actionType === 'change_priority' || actionType === 'add_tag') {
            const latest = await db.query(
              `select * from follow_ups where related_entity_type=$1 and related_entity_id=$2 and status=any($3::text[]) and deleted_at is null order by due_at asc limit 1`,
              [entityType, entityId, ACTIVE_FOLLOW_UP_STATUSES]
            );
            const current = followUpModel.hydrateRow(latest.rows[0]);
            if (current && actionType === 'escalate') {
              const updated = await escalateFollowUp(current.id, { level: action.level, escalatedTo: action.escalatedTo, reason: action.reason || rule.name, action: 'automation_rule' }, actor, { db, system: true });
              outputs.push({ action: actionType, followUpId: updated.id });
            } else if (current) {
              const patch = actionType === 'change_priority'
                ? { priority: PRIORITIES.includes(action.priority) ? action.priority : current.priority, priorityReason: action.reason || `Automation rule: ${rule.name}` }
                : { tags: [...new Set([...(current.tags || []), ...(Array.isArray(action.tags) ? action.tags : [action.tag])].filter(Boolean))] };
              const updated = await followUpModel.update(current.id, { ...patch, automationRuleId: rule.id, updatedBy: actor?.id || null, version: Number(current.version || 1) + 1 }, db);
              await recordAudit(db, current.id, `automation_${actionType}`, actor?.id, current, updated, { ruleId: rule.id });
              outputs.push({ action: actionType, followUpId: current.id });
            }
          } else if (actionType === 'send_notification' || actionType === 'notify') {
            const recipientUserId = action.recipientUserId || action.assignedTo || related?.owner_user_id || actor?.id;
            if (recipientUserId) {
              await db.query(
                `insert into notifications (id,recipient_type,user_id,module_name,event_key,entity_type,entity_id,title,message,severity,is_read,email_status,route_path,channels,idempotency_key,payload)
                 values ($1,'user',$2,'followups','automation_rule',$3,$4,$5,$6,$7,false,'pending',$8,'["inApp"]'::jsonb,$9,$10::jsonb)
                 on conflict (idempotency_key) do nothing`,
                [createId('notification'), recipientUserId, entityType.toLowerCase(), entityId, action.title || rule.name,
                  action.message || `${rule.name} requires attention`, action.severity || 'info', '/app/follow-ups', `${idempotencyKey}:notify:${outputs.length}`, JSON.stringify({ ruleId: rule.id, triggerKey })]
              );
              outputs.push({ action: actionType, recipientUserId });
            }
          } else {
            outputs.push({ action: actionType || 'unknown', skipped: true, reason: 'Unsupported action; no external side effect was attempted' });
          }
        }
        await db.query(`update follow_up_automation_executions set status='Success',result=$2::jsonb,executed_at=now() where id=$1`, [executionId, JSON.stringify(outputs)]);
        summary.executed += 1;
        summary.results.push({ ruleId: rule.id, status: 'Success', outputs });
      } catch (error) {
        await db.query(`update follow_up_automation_executions set status='Failed',error_message=$2,executed_at=now() where id=$1`, [executionId, error.message]);
        summary.failed += 1;
        summary.results.push({ ruleId: rule.id, status: 'Failed', message: error.message });
      }
    }
    return summary;
  };
  return options.db ? work(options.db) : withTransaction(work);
}

async function handleBusinessTrigger(triggerKey, entityType, entityId, actor = null, options = {}) {
  const normalized = normalizeEntityType(entityType);
  const terminalTriggers = ['quotation_approved', 'quotation_rejected', 'payment_received', 'lead_converted', 'renewal_completed'];
  const sequence = terminalTriggers.includes(triggerKey)
    ? await stopSequences(normalized, entityId, triggerKey, actor, options.db)
    : await startSequence({ triggerKey, relatedEntityType: normalized, relatedEntityId: entityId, actor, db: options.db, payload: options.payload || {} });
  const automation = await executeAutomationRules(triggerKey, {
    relatedEntityType: normalized, relatedEntityId: entityId, payload: options.payload || {},
    eventId: options.eventId || options.idempotencyKey || `${normalized}:${entityId}`
  }, actor, options);
  return { sequence, automation };
}

async function ensureEntityFollowUp(entityType, entityId, defaults = {}, actor = null, options = {}) {
  const exec = options.db?.query ? options.db.query.bind(options.db) : query;
  const existing = await exec(
    `select id from follow_ups where related_entity_type = $1 and related_entity_id = $2 and status = any($3::text[]) and deleted_at is null limit 1`,
    [normalizeEntityType(entityType), entityId, ACTIVE_FOLLOW_UP_STATUSES]
  );
  if (existing.rows[0]) return { record: await followUpModel.findById(existing.rows[0].id, options.db), existing: true };
  const created = await createFollowUp({ ...defaults, relatedEntityType: entityType, relatedEntityId: entityId, isAutomatic: true, source: defaults.source || 'automation' }, actor, { db: options.db, system: true });
  return { ...created, existing: false };
}

async function autoCloseEntityFollowUps(entityType, entityId, reason, actor = null, options = {}) {
  const work = async (db) => {
    const result = await db.query(
      `select * from follow_ups where related_entity_type = $1 and related_entity_id = $2
       and status = any($3::text[]) and deleted_at is null for update`,
      [normalizeEntityType(entityType), entityId, ACTIVE_FOLLOW_UP_STATUSES]
    );
    const closed = [];
    for (const row of result.rows) {
      const current = followUpModel.hydrateRow(row);
      const updated = await followUpModel.update(current.id, {
        status: 'Auto-Closed', actualOutcome: reason, communicationResult: reason,
        discussionNote: reason, noNextFollowUpReason: reason,
        completedAt: new Date().toISOString(), completedBy: actor?.id || null,
        updatedBy: actor?.id || null, version: Number(current.version || 1) + 1
      }, db);
      await recordStatus(db, current.id, current.status, 'Auto-Closed', actor?.id, reason, { automatic: true });
      await recordAudit(db, current.id, 'auto_closed', actor?.id, current, updated, { reason });
      await createTimelineEvent(db, updated, actor?.id, 'follow_up_auto_closed', reason);
      closed.push(updated);
    }
    return closed;
  };
  return options.db ? work(options.db) : withTransaction(work);
}

async function processSequenceEnrollments(db) {
  const enrollments = await db.query(`select * from follow_up_sequence_enrollments where status = 'Active' and next_run_at <= now() order by next_run_at asc limit 100 for update skip locked`);
  let processed = 0;
  for (const enrollment of enrollments.rows) {
    const stepResult = await db.query(
      `select * from follow_up_sequence_steps where sequence_id = $1 and is_active = true and step_order > $2 order by step_order asc limit 1`,
      [enrollment.sequence_id, enrollment.current_step_order]
    );
    const step = stepResult.rows[0];
    if (!step) {
      await db.query(`update follow_up_sequence_enrollments set status='Completed', next_run_at=null, updated_at=now() where id=$1`, [enrollment.id]);
      continue;
    }
    const key = `sequence-execution:${enrollment.id}:${step.id}`;
    const exists = await db.query('select id from follow_up_sequence_executions where idempotency_key = $1 limit 1', [key]);
    if (!exists.rows[0] && step.action_type === 'create_follow_up') {
      const context = await findRelatedEntity(enrollment.related_entity_type, enrollment.related_entity_id, db);
      const dueAt = new Date().toISOString();
      const result = await createFollowUp({
        relatedEntityType: enrollment.related_entity_type, relatedEntityId: enrollment.related_entity_id,
        relatedEntityLabel: context?.label, title: step.title_template || step.name,
        followUpType: step.follow_up_type || 'Call', purpose: step.name, dueAt,
        assignedTo: context?.owner_user_id || enrollment.started_by, reminderSettings: step.reminder_settings || [],
        source: 'sequence', isAutomatic: true, sequenceId: enrollment.sequence_id, sequenceStepId: step.id
      }, { id: enrollment.started_by }, { db, system: true });
      await db.query(
        `insert into follow_up_sequence_executions (id,enrollment_id,sequence_step_id,step_order,action_type,status,idempotency_key,result)
         values ($1,$2,$3,$4,$5,'Success',$6,$7::jsonb)`,
        [createId('fuseqexec'), enrollment.id, step.id, step.step_order, step.action_type, key, JSON.stringify({ followUpId: result.record.id })]
      );
    } else if (!exists.rows[0] && step.action_type === 'escalate') {
      const latest = await db.query(
        `select id from follow_ups where related_entity_type=$1 and related_entity_id=$2 and status=any($3::text[]) and deleted_at is null order by due_at desc limit 1`,
        [enrollment.related_entity_type, enrollment.related_entity_id, ACTIVE_FOLLOW_UP_STATUSES]
      );
      if (latest.rows[0]) await escalateFollowUp(latest.rows[0].id, { reason: step.name, action: 'sequence_escalation' }, { id: enrollment.started_by }, { db, system: true });
      await db.query(
        `insert into follow_up_sequence_executions (id,enrollment_id,sequence_step_id,step_order,action_type,status,idempotency_key,result)
         values ($1,$2,$3,$4,$5,'Success',$6,'{}'::jsonb)`,
        [createId('fuseqexec'), enrollment.id, step.id, step.step_order, step.action_type, key]
      );
    }
    const next = await db.query(`select * from follow_up_sequence_steps where sequence_id=$1 and is_active=true and step_order>$2 order by step_order asc limit 1`, [enrollment.sequence_id, step.step_order]);
    await db.query(
      `update follow_up_sequence_enrollments set current_step_order=$2, status=$3, next_run_at=$4, updated_at=now() where id=$1`,
      [enrollment.id, step.step_order, next.rows[0] ? 'Active' : 'Completed', next.rows[0] ? new Date(Date.now() + Number(next.rows[0].delay_minutes || 0) * 60000).toISOString() : null]
    );
    processed += 1;
  }
  return processed;
}

async function processDueReminders(db) {
  const reminders = await db.query(
    `select r.*, f.follow_up_number, f.title, f.priority, f.related_entity_label, f.assigned_to
     from follow_up_reminders r join follow_ups f on f.id=r.follow_up_id
     where r.status in ('pending','retry') and r.scheduled_at <= now() and f.deleted_at is null and f.status=any($1::text[])
     order by r.scheduled_at asc limit 200 for update of r skip locked`,
    [ACTIVE_FOLLOW_UP_STATUSES]
  );
  let sent = 0;
  for (const reminder of reminders.rows) {
    if (!reminder.recipient_user_id || reminder.channel !== 'inApp') {
      await db.query(`update follow_up_reminders set status='skipped', failure_reason=$2, updated_at=now() where id=$1`, [reminder.id, reminder.channel === 'inApp' ? 'Recipient missing' : 'Channel requires configured integration']);
      continue;
    }
    const notificationKey = `notification:${reminder.id}`;
    const notificationId = createId('notification');
    await db.query(
      `insert into notifications (id,recipient_type,user_id,module_name,event_key,entity_type,entity_id,title,message,severity,is_read,email_status,route_path,channels,idempotency_key,payload)
       values ($1,'user',$2,'followups','reminder_due','followup',$3,$4,$5,$6,false,'pending',$7,'["inApp"]'::jsonb,$8,$9::jsonb)
       on conflict (idempotency_key) do nothing`,
      [notificationId, reminder.recipient_user_id, reminder.follow_up_id, reminder.title, `${reminder.related_entity_label || 'Record'} · ${reminder.follow_up_number} is due`, reminder.priority === 'Critical' ? 'danger' : reminder.priority === 'High' ? 'warning' : 'info', `/app/follow-ups?focus=${reminder.follow_up_id}`, notificationKey, JSON.stringify({ followUpId: reminder.follow_up_id, reminderId: reminder.id })]
    );
    await db.query(`update follow_up_reminders set status='sent', sent_at=now(), updated_at=now() where id=$1`, [reminder.id]);
    await db.query(
      `insert into follow_up_notification_logs (id,follow_up_id,reminder_id,channel,recipient,sent_at,delivery_status,idempotency_key,payload)
       values ($1,$2,$3,'inApp',$4,now(),'sent',$5,$6::jsonb) on conflict (idempotency_key) do nothing`,
      [createId('funotif'), reminder.follow_up_id, reminder.id, reminder.recipient_user_id, notificationKey, JSON.stringify({ notificationId })]
    );
    sent += 1;
  }
  return sent;
}

async function processOverdueEscalations(db) {
  const settings = await getSettings(db);
  const schedule = Array.isArray(settings.escalationSchedule) ? [...settings.escalationSchedule].sort((a, b) => Number(a.minutesOverdue) - Number(b.minutesOverdue)) : [];
  const result = await db.query(
    `select * from follow_ups where deleted_at is null and status=any($1::text[]) and due_at < now() order by due_at asc limit 200 for update skip locked`,
    [ACTIVE_FOLLOW_UP_STATUSES]
  );
  let escalated = 0;
  for (const row of result.rows) {
    const record = followUpModel.hydrateRow(row);
    const minutes = Math.floor(calculateOverdueSeconds(record) / 60);
    const level = getEscalationLevel(minutes, schedule);
    if (level > Number(record.escalationLevel || 0)) {
      await escalateFollowUp(record.id, { level, reason: `Overdue by ${minutes} minutes`, action: 'automatic_overdue' }, null, { db, system: true });
      escalated += 1;
    }
  }
  return escalated;
}

async function processRenewalRisks(db) {
  const settings = await getSettings(db);
  const renewalWindowDays = Math.max(1, Number(settings.protectionThresholds?.renewalWindowDays || 90));
  const result = await db.query(
    `select id, coalesce(renewal_date,expiry_date,reminder_date) as due_date
     from renewals where lower(status) not in ('renewed','cancelled') and coalesce(renewal_date,expiry_date,reminder_date) <= current_date + $1::int`,
    [renewalWindowDays]
  );
  let created = 0;
  for (const renewal of result.rows) {
    const ensured = await ensureEntityFollowUp('Renewal', renewal.id, {
      title: 'Renewal follow-up', followUpType: 'Renewal follow-up', purpose: 'Renewal decision',
      dueAt: parseDateTime('', renewal.due_date, '10:00', settings.timezone), priorityContext: { daysToExpiry: Math.ceil((new Date(renewal.due_date) - new Date()) / 86400000) }
    }, null, { db });
    if (!ensured.existing) created += 1;
    await handleBusinessTrigger('renewal_approaching', 'Renewal', renewal.id, null, {
      db, eventId: renewal.id, payload: { dueDate: renewal.due_date }
    });
  }
  return created;
}

async function processPaymentPromises(db) {
  const promises = await db.query(`update payment_promises set missed=true,status='Missed',updated_at=now() where status='Pending' and promise_date < current_date returning *`);
  let created = 0;
  for (const promise of promises.rows) {
    const ensured = await ensureEntityFollowUp('Invoice', promise.invoice_id, {
      title: 'Missed payment promise', followUpType: 'Payment follow-up', purpose: 'Promise date missed',
      dueAt: new Date().toISOString(), priority: 'Critical', priorityContext: { promiseMissed: true },
      description: promise.note || 'Payment promise date has passed.'
    }, null, { db });
    if (!ensured.existing) created += 1;
    await handleBusinessTrigger('payment_promise_missed', 'Invoice', promise.invoice_id, null, {
      db, eventId: promise.id, payload: promise
    });
  }
  return { missed: promises.rowCount, created };
}

async function runAutomationCycle({ runSource = 'cron' } = {}) {
  return withTransaction(async (db) => {
    const startedAt = new Date().toISOString();
    const remindersSent = await processDueReminders(db);
    const escalations = await processOverdueEscalations(db);
    const sequenceSteps = await processSequenceEnrollments(db);
    const renewalFollowUps = await processRenewalRisks(db);
    const paymentPromises = await processPaymentPromises(db);
    const result = { runSource, startedAt, completedAt: new Date().toISOString(), remindersSent, escalations, sequenceSteps, renewalFollowUps, paymentPromises };
    await db.query(
      `insert into workflow_automation_logs (id,module_name,entity_id,run_id,run_source,action,status,reference_name,message,payload)
       values ($1,'followups','engine',$2,$3,'automation_cycle','Success','Advanced Follow-up Engine',$4,$5::jsonb)`,
      [createId('wflog'), createId('furun'), runSource, `Processed ${remindersSent} reminders and ${escalations} escalations`, JSON.stringify(result)]
    );
    return result;
  });
}

function createFollowUpScheduler({ schedule = process.env.FOLLOW_UP_AUTOMATION_CRON || '*/10 * * * *', timezone = process.env.FOLLOW_UP_TIMEZONE || 'Asia/Kolkata' } = {}) {
  const cron = require('node-cron');
  if (!cron.validate(schedule)) throw new Error(`Invalid follow-up automation cron schedule: ${schedule}`);
  return cron.schedule(schedule, () => {
    runAutomationCycle({ runSource: 'cron' }).catch((error) => console.error('[Follow-ups] Automation failed:', error.message));
  }, { timezone });
}

module.exports = {
  ACTIVE_FOLLOW_UP_STATUSES,
  CLOSED_FOLLOW_UP_STATUSES,
  FOLLOW_UP_TYPES,
  OUTCOMES,
  PRIORITIES,
  acknowledgeReminder,
  autoCloseEntityFollowUps,
  calculateEffectiveStatus,
  calculateOverdueSeconds,
  calculatePriority,
  calculateReminderAt,
  completeFollowUp,
  createFollowUp,
  createFollowUpScheduler,
  ensureEntityFollowUp,
  escalateFollowUp,
  executeAutomationRules,
  getAnalytics,
  getAttentionRequired,
  getCommandCenter,
  getFollowUp,
  getNextRecurrenceAt,
  getEscalationLevel,
  getSettings,
  handleBusinessTrigger,
  isTerminalRelatedStatus,
  isWithinBusinessHours,
  listConfig,
  listFollowUps,
  matchesConditions,
  markInProgress,
  nextBusinessTime,
  normalizeEntityType,
  parseDateTime,
  reassignFollowUp,
  rescheduleFollowUp,
  restoreFollowUp,
  runAutomationCycle,
  scheduleRetry,
  saveConfig,
  softDeleteFollowUp,
  startSequence,
  stopSequences,
  updateFollowUp,
  updateSettings
};
