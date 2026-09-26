const { createCrudController } = require('./crudController');
const leadModel = require('../models/lead.model');
const leadEventModel = require('../models/leadEvent.model');
const leadContactModel = require('../models/leadContact.model');
const clientContactModel = require('../models/clientContact.model');
const clientModel = require('../models/client.model');
const masterItemModel = require('../models/masterItem.model');
const projectModel = require('../models/project.model');
const invoiceModel = require('../models/invoice.model');
const { query, withTransaction } = require('../config/db');
const { getSettings } = require('../models/settings.model');
const { buildLeadSummary } = require('../services/analytics.service');
const { notifyBusinessEvent } = require('../services/notification.service');
const { LEAD_OPTIONS, LEAD_SCORE_RULES, calculateLeadScore } = require('../config/leadManagement');
const { createValidationError, toList, validateLeadPayload } = require('../services/leadValidation.service');
const { hasPermission } = require('../middlewares/auth');
const { createId } = require('../utils/format');
const followUpEngine = require('../services/followUpEngine.service');
const {
  DEFAULT_PIPELINE_ID,
  canAccessPipeline,
  ensureDefaultLeadPipeline,
  getPipelineIdOrDefault,
  getUserAllowedPipelineIds,
  userHasAllPipelineAccess
} = require('../services/leadPipelineAccess.service');

const LEAD_WRITABLE_FIELDS = new Set([
  'name', 'companyName', 'contactPerson', 'type', 'email', 'phone', 'alternatePhone', 'whatsappNumber',
  'website', 'preferredLanguage', 'preferredContactMethod', 'preferredContactTime', 'pipelineId', 'status',
  'source', 'campaignName', 'sourceReference', 'utmSource', 'utmMedium', 'utmCampaign', 'referrerType',
  'referrerName', 'referrerContact', 'referrerReferenceId', 'commissionApplicable', 'commissionType',
  'commissionValue', 'commissionNotes', 'requiredServices', 'requiredService', 'otherServiceDetails',
  'requirementTitle', 'requirementSummary', 'requirementDescription', 'clientPainPoints', 'expectedFeatures',
  'referenceUrl', 'preferredTechnology', 'existingSystemDetails', 'expectedStartDate', 'expectedDeliveryDate',
  'requirementAttachments', 'attachmentDraftId', 'value', 'estimatedBudget', 'budgetMin', 'budgetMax',
  'budgetRange', 'budgetConfirmed', 'billingType', 'gstInvoiceRequired', 'expectedClosingDate',
  'paymentPreference', 'purchaseTimeline', 'leadTemperature', 'priority', 'conversionProbability', 'statusNote',
  'followUpDate', 'nextFollowUpTime', 'followUpMode', 'reminder', 'followUpNote', 'assignedTeam',
  'followUpPriority', 'assignedTo', 'leadOwner', 'secondaryAssignees', 'managers', 'address', 'city', 'state',
  'pincode', 'country', 'vatNumber', 'gstNumber', 'currency', 'currencySymbol', 'labels', 'ownerName', 'notes',
  'firstConversationSummary', 'lastConversationSummary', 'clientExpectations', 'internalNotes',
  'preferredCommunicationChannel', 'lastContactDate', 'lastContactTime', 'decisionMakerIdentified',
  'contactIsDecisionMaker', 'requirementConfirmed', 'timelineConfirmed', 'authorityConfirmed', 'needConfirmed',
  'qualificationNotes', 'lostReason', 'lostReasonNotes', 'competitorName', 'competitorPrice',
  'reconnectInFuture', 'reconnectDate', 'originalLeadId'
]);

function pickLeadInput(body = {}) {
  return Object.fromEntries(Object.entries(body || {}).filter(([key]) => LEAD_WRITABLE_FIELDS.has(key)));
}

function normalizeLabels(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') return String(item.label || item.value || '').trim();
        return '';
      })
      .filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? normalizeLabels(parsed) : [];
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  return [];
}

function isWonStatus(settings, status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return false;

  const leadStatuses = Array.isArray(settings?.statuses?.leads) ? settings.statuses.leads : [];
  const wonLabels = leadStatuses
    .filter((item) => item && typeof item === 'object' && String(item.state || '').toLowerCase() === 'won')
    .map((item) => String(item.label || '').trim().toLowerCase())
    .filter(Boolean);

  return wonLabels.includes(normalized) || normalized === 'won';
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return `+${digits}`;
}

function getActorName(user) {
  if (!user) return 'System';
  return user.fullName || user.username || user.email || 'System';
}

function normalizeLeadLabels(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') return String(item.label || item.value || '').trim();
        return '';
      })
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? normalizeLeadLabels(parsed) : [];
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeSharedLabels(value) {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value).flat()
      : [];

  return source
    .map((item) => {
      if (typeof item === 'string') {
        const label = item.trim();
        return label ? { label, color: '#64748b' } : null;
      }
      if (item && typeof item === 'object') {
        const label = String(item.label || item.value || '').trim();
        if (!label) return null;
        return { label, color: item.color || item.badgeColor || '#64748b' };
      }
      return null;
    })
    .filter(Boolean);
}

function serializeForCompare(value) {
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((item) => String(item || '').trim()).filter(Boolean).sort());
  }
  if (value == null) return '';
  return String(value).trim();
}

function getLeadPatch(body = {}, current = null, req = null) {
  const input = pickLeadInput(body);
  const type = input.type || current?.type || 'Organization';
  const companyName = String(input.companyName ?? current?.companyName ?? '').trim();
  const name = String(input.name ?? current?.name ?? '').trim();
  const contactPerson = String(input.contactPerson ?? current?.contactPerson ?? (type === 'Person' ? name : '')).trim();
  const ownerName = input.ownerName !== undefined
    ? String(input.ownerName || '').trim()
    : String(current?.ownerName || '').trim();
  const phone = normalizePhone(input.phone !== undefined ? input.phone : current?.phone);
  const alternatePhone = normalizePhone(input.alternatePhone !== undefined ? input.alternatePhone : current?.alternatePhone);
  const whatsappNumber = normalizePhone(input.whatsappNumber !== undefined ? input.whatsappNumber : current?.whatsappNumber);
  const referrerContact = normalizePhone(input.referrerContact !== undefined ? input.referrerContact : current?.referrerContact);
  const labels = normalizeLeadLabels(input.labels !== undefined ? input.labels : current?.labels || []);
  const requiredServices = toList(input.requiredServices ?? input.requiredService ?? current?.requiredServices ?? []);
  const assignedTo = input.assignedTo !== undefined
    ? (String(input.assignedTo || '').trim() || null)
    : current?.assignedTo || req?.user?.id || null;
  const leadOwner = input.leadOwner !== undefined
    ? (String(input.leadOwner || '').trim() || null)
    : current?.leadOwner || assignedTo;
  const estimatedBudget = input.estimatedBudget !== undefined
    ? input.estimatedBudget
    : current?.estimatedBudget ?? input.value ?? current?.value ?? 0;
  const value = input.value !== undefined ? input.value : current?.value ?? estimatedBudget ?? 0;
  const nextStatus = input.status ?? current?.status ?? 'New';
  const originalLeadId = input.originalLeadId !== undefined
    ? (String(input.originalLeadId || '').trim() || null)
    : current?.originalLeadId || null;
  const statusChanged = Boolean(current) && String(current.status || '').trim() !== String(nextStatus || '').trim();
  const now = new Date().toISOString();

  const patch = {
    ...input,
    type,
    name: type === 'Organization' ? (companyName || name) : name,
    companyName: type === 'Organization' ? companyName : companyName || name,
    contactPerson,
    phone,
    alternatePhone,
    whatsappNumber,
    referrerContact,
    ownerName,
    labels,
    requiredServices,
    value,
    estimatedBudget,
    leadScore: calculateLeadScore({ ...current, ...input, phone, whatsappNumber, requiredServices }),
    pipelineId: input.pipelineId || current?.pipelineId || DEFAULT_PIPELINE_ID,
    createdBy: current?.createdBy || req?.user?.id || null,
    updatedBy: req?.user?.id || current?.updatedBy || null,
    assignedTo,
    leadOwner,
    originalLeadId
  };

  delete patch.requiredService;
  delete patch.attachmentDraftId;

  if (statusChanged) {
    patch.lastStatusChangedAt = now;
    patch.lastStatusChangedBy = req?.user?.id || null;
  }
  if (['Lost', 'Not Interested'].includes(nextStatus) && !['Lost', 'Not Interested'].includes(current?.status)) {
    patch.lostAt = now;
    patch.lostBy = req?.user?.id || null;
  }

  return patch;
}

function forbiddenPipelineError() {
  const error = new Error('You do not have access to this lead pipeline');
  error.statusCode = 403;
  return error;
}

async function resolveLeadPipelineId(body = {}, current = null, req = null, db = null) {
  await ensureDefaultLeadPipeline(db);
  const hasPipelineInput = Object.prototype.hasOwnProperty.call(body, 'pipelineId')
    || Object.prototype.hasOwnProperty.call(body, 'pipeline_id');
  const requested = hasPipelineInput ? (body.pipelineId || body.pipeline_id) : current?.pipelineId;
  const allowed = getUserAllowedPipelineIds(req?.user);
  const fallback = !requested && !userHasAllPipelineAccess(req?.user) && allowed.length ? allowed[0] : DEFAULT_PIPELINE_ID;
  const pipelineId = await getPipelineIdOrDefault(requested || fallback, db);

  if (!canAccessPipeline(req?.user, pipelineId)) {
    throw forbiddenPipelineError();
  }

  return pipelineId;
}

function filterLeadsByPipelineAccess(rows = [], req = null) {
  if (userHasAllPipelineAccess(req?.user)) return rows;
  return rows.filter((row) => canAccessPipeline(req?.user, row.pipelineId || DEFAULT_PIPELINE_ID));
}

async function findAccessibleLeadById(leadId, req, db = null) {
  const lead = await leadModel.findById(leadId, db);
  if (!lead) return null;
  if (!canAccessPipeline(req?.user, lead.pipelineId || DEFAULT_PIPELINE_ID)) {
    throw forbiddenPipelineError();
  }
  return lead;
}

async function assertActiveAssignee(userId, db = null) {
  if (!userId) return;
  const exec = db?.query || query;
  const result = await exec.call(db || null, 'select id, is_active from users where id = $1 limit 1', [userId]);
  if (!result.rows[0]?.is_active) {
    throw createValidationError({ assignedTo: 'Assigned employee must be an active user' });
  }
}

function validateLeadForSave(lead, { isCreate = false, current = null } = {}) {
  const legacyRecord = Boolean(current && (
    !current.contactPerson || !current.phone || !toList(current.requiredServices).length
  ));
  const previousStatus = String(current?.status || '').trim();
  const nextStatus = String(lead.status || '').trim();
  const previousSource = String(current?.source || '').trim();
  const nextSource = String(lead.source || '').trim();
  const previousServices = serializeForCompare(toList(current?.requiredServices || []));
  const nextServices = serializeForCompare(toList(lead.requiredServices || lead.requiredService || []));
  const previousOtherServiceDetails = String(current?.otherServiceDetails || '').trim();
  const nextOtherServiceDetails = String(lead.otherServiceDetails || '').trim();
  const result = validateLeadPayload(lead, {
    isCreate,
    legacyRecord,
    enforceLostFields: Boolean(current && previousStatus !== nextStatus && ['Lost', 'Not Interested'].includes(nextStatus)),
    enforceReferralFields: Boolean(current && previousSource !== nextSource && ['Referral', 'Partner Referral'].includes(nextSource)),
    enforceDuplicateFields: Boolean(current && previousStatus !== nextStatus && nextStatus === 'Duplicate'),
    enforceOtherServiceDetails: Boolean(isCreate || previousServices !== nextServices || previousOtherServiceDetails !== nextOtherServiceDetails)
  });
  if (!result.isValid) throw createValidationError(result.errors);
  return { ...lead, ...result.normalized };
}

function sanitizeLeadForUser(lead, user) {
  if (!lead) return lead;
  const sanitized = { ...lead };
  const canViewBudget = hasPermission(user, 'leads.view_budget') || hasPermission(user, 'leads.write');
  const canViewCommission = hasPermission(user, 'leads.view_commission') || hasPermission(user, 'lead-commissions.read');

  if (!canViewBudget) {
    ['value', 'estimatedBudget', 'budgetMin', 'budgetMax', 'budgetRange', 'budgetConfirmed', 'billingType', 'gstInvoiceRequired', 'paymentPreference'].forEach((key) => {
      delete sanitized[key];
    });
  }
  if (!canViewCommission) {
    ['commissionApplicable', 'commissionType', 'commissionValue', 'commissionNotes'].forEach((key) => {
      delete sanitized[key];
    });
  }
  if (!hasPermission(user, 'leads.write')) {
    delete sanitized.internalNotes;
  }
  return sanitized;
}

function sanitizeLeadEventForUser(event, user) {
  if (!event || hasPermission(user, 'leads.view_call_recording')) return event;
  const sanitized = { ...event };
  if (String(event.eventType || '').toLowerCase() === 'call') {
    const payload = { ...(event.payload || {}) };
    delete payload.callRecordingUrl;
    delete payload.recordingFile;
    sanitized.payload = payload;
    sanitized.attachments = (Array.isArray(event.attachments) ? event.attachments : []).filter((file) => file?.kind !== 'call_recording');
  }
  return sanitized;
}

async function findDuplicateLeads({ phone = '', email = '', excludeId = '' } = {}, req = null, db = null) {
  const clauses = [];
  const values = [];
  const digits = String(phone || '').replace(/\D/g, '');
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (digits.length >= 7) {
    values.push(digits);
    clauses.push(`regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $${values.length}`);
  }
  if (normalizedEmail) {
    values.push(normalizedEmail);
    clauses.push(`lower(trim(coalesce(email, ''))) = $${values.length}`);
  }
  if (!clauses.length) return [];

  let sql = `select * from leads where (${clauses.join(' OR ')})`;
  if (excludeId) {
    values.push(excludeId);
    sql += ` and id <> $${values.length}`;
  }
  sql += ' order by updated_at desc limit 10';
  const exec = db?.query || query;
  const result = await exec.call(db || null, sql, values);
  return filterLeadsByPipelineAccess(result.rows.map((row) => leadModel.hydrateRow(row)), req);
}

async function findDuplicateClients(lead, db = null) {
  const clauses = [];
  const values = [];
  const digits = String(lead?.phone || '').replace(/\D/g, '');
  const email = String(lead?.email || '').trim().toLowerCase();
  if (digits.length >= 7) {
    values.push(digits);
    clauses.push(`regexp_replace(coalesce(mobile, ''), '\\D', '', 'g') = $${values.length}`);
  }
  if (email) {
    values.push(email);
    clauses.push(`lower(trim(coalesce(email, ''))) = $${values.length}`);
  }
  if (!clauses.length) return [];
  const exec = db?.query || query;
  const result = await exec.call(db || null, `select * from clients where (${clauses.join(' OR ')}) order by updated_at desc limit 10`, values);
  return result.rows.map((row) => clientModel.hydrateRow(row));
}

function assertConversionPermissions(user, options = {}) {
  if (!hasPermission(user, 'clients.read') && !hasPermission(user, 'clients.write')) {
    const error = new Error('Client access permission is required for lead conversion');
    error.statusCode = 403;
    throw error;
  }
  if ((!options.existingClientId || options.forceCreateClient) && !hasPermission(user, 'clients.write')) {
    const error = new Error('Client write permission is required to create a client');
    error.statusCode = 403;
    throw error;
  }
  if (options.createProject === true && !hasPermission(user, 'projects.write')) {
    const error = new Error('Project write permission is required to create a project');
    error.statusCode = 403;
    throw error;
  }
}

function toClientMatch(client = {}) {
  return {
    id: client.id,
    name: client.name || '',
    companyName: client.companyName || '',
    mobile: client.mobile || '',
    email: client.email || ''
  };
}

function getFieldChangeSummary(current = {}, next = {}) {
  const fields = [
    ['type', 'Type'],
    ['name', 'Name'],
    ['companyName', 'Company name'],
    ['pipelineId', 'Pipeline'],
    ['ownerName', 'Owner'],
    ['phone', 'Phone'],
    ['email', 'Email'],
    ['status', 'Status'],
    ['source', 'Source'],
    ['requiredServices', 'Required services'],
    ['requirementSummary', 'Requirement summary'],
    ['followUpDate', 'Follow up date'],
    ['nextFollowUpTime', 'Follow up time'],
    ['assignedTo', 'Assigned employee'],
    ['leadTemperature', 'Temperature'],
    ['priority', 'Priority'],
    ['estimatedBudget', 'Estimated budget'],
    ['value', 'Value'],
    ['labels', 'Labels'],
    ['notes', 'Notes'],
    ['city', 'City'],
    ['state', 'State'],
    ['country', 'Country']
  ];

  const changes = [];
  fields.forEach(([key, label]) => {
    const before = serializeForCompare(current[key]);
    const after = serializeForCompare(next[key]);
    if (before !== after) {
      changes.push({ key, label, before: current[key], after: next[key] });
    }
  });
  return changes;
}

async function createLeadTimelineEvent(db, lead, req, { kind, title, description, meta = {}, date = null, eventType = 'system' }) {
  const actor = req?.user || null;
  return leadEventModel.create({
    leadId: lead.id,
    scopeType: 'lead',
    scopeId: lead.id,
    ownerUserId: actor?.id || null,
    visibility: 'all_team',
    eventType,
    title,
    description,
    startDate: date || lead.updatedAt || lead.createdAt || null,
    endDate: date || lead.updatedAt || lead.createdAt || null,
    payload: {
      kind,
      actorUserId: actor?.id || null,
      actorName: getActorName(actor),
      meta
    }
  }, db);
}

function buildClientFromLead(lead, settings, primaryContactName = '') {
  const leadLabels = normalizeLabels(lead.labels);
  const labelColorMap = new Map();

  [
    ...normalizeSharedLabels(settings?.labels || [])
  ].forEach((item) => {
    if (item && typeof item === 'object') {
      const label = String(item.label || item.value || '').trim();
      if (label) labelColorMap.set(label.toLowerCase(), item.color || '#64748b');
    }
  });

  return {
    name: lead.type === 'Person' ? (lead.name || lead.companyName || '') : (lead.companyName || lead.name || ''),
    companyName: lead.companyName || '',
    clientType: lead.type === 'Person' ? 'Person' : 'Organization',
    assignedTo: lead.assignedTo || '',
    managers: lead.managers || '',
    source: lead.source || '',
    mobile: lead.phone || '',
    whatsappNumber: lead.whatsappNumber || '',
    email: lead.email || '',
    website: lead.website || '',
    billingAddress: lead.address || '',
    contactPerson: primaryContactName || lead.contactPerson || lead.ownerName || '',
    city: lead.city || '',
    state: lead.state || '',
    pincode: lead.pincode || '',
    country: lead.country || 'India',
    vatNumber: lead.vatNumber || '',
    gstNumber: lead.gstNumber || '',
    currency: lead.currency || 'INR',
    currencySymbol: lead.currencySymbol || '',
    labels: leadLabels.map((label) => {
      const color = labelColorMap.get(String(label).toLowerCase());
      return color ? { label, color } : label;
    }),
    followUpDate: lead.followUpDate || '',
    notes: lead.notes || '',
    gstInvoiceRequired: lead.gstInvoiceRequired || '',
    requiredServices: toList(lead.requiredServices),
    convertedLeadId: lead.id,
    status: 'Active'
  };
}

async function convertLeadRecord(leadId, settings, db, req, options = {}) {
  const current = await leadModel.findById(leadId, db);
  if (!current) return null;
  const resolvedLeadId = current.id;

  if (current.convertedClientId) {
    const existingConvertedClient = await clientModel.findById(current.convertedClientId, db);
    if (existingConvertedClient) {
      const existingProject = current.convertedProjectId ? await projectModel.findById(current.convertedProjectId, db) : null;
      return { lead: current, client: existingConvertedClient, project: existingProject, alreadyConverted: true };
    }
  }

  const leadContactsResult = await db.query(
    'select * from lead_contacts where lead_id = $1 order by created_at asc, updated_at asc',
    [resolvedLeadId]
  );
  const leadContacts = leadContactsResult.rows.map((row) => leadContactModel.hydrateRow(row)).filter(Boolean);
  const primaryLeadContact = leadContacts[0] || null;
  const primaryContactName = primaryLeadContact
    ? `${primaryLeadContact.firstName || ''} ${primaryLeadContact.lastName || ''}`.trim()
    : String(current.ownerName || current.contactPerson || '').trim();

  const duplicateClients = await findDuplicateClients(current, db);
  let clientRecord = null;
  if (options.existingClientId) {
    clientRecord = await clientModel.findById(options.existingClientId, db);
    if (!clientRecord) throw createValidationError({ existingClientId: 'Selected client was not found' });
  } else if (options.useExistingClient === true && duplicateClients.length === 1) {
    clientRecord = duplicateClients[0];
  } else if (duplicateClients.length && options.forceCreateClient !== true) {
    const error = new Error('A matching client already exists. Select it or explicitly create a new client.');
    error.statusCode = 409;
    error.details = { duplicateClients: duplicateClients.map(toClientMatch) };
    throw error;
  } else {
    clientRecord = await clientModel.create(buildClientFromLead(current, settings, primaryContactName), db);
  }

  const existingContactResult = await db.query(
    'select lower(coalesce(email, \'\')) as email, regexp_replace(coalesce(phone, \'\'), \'[^0-9]\', \'\', \'g\') as phone from client_contacts where client_id = $1',
    [clientRecord.id]
  );
  const existingContactKeys = new Set(existingContactResult.rows.flatMap((row) => [
    row.email ? `email:${row.email}` : '',
    row.phone ? `phone:${row.phone}` : ''
  ]).filter(Boolean));

  if (leadContacts.length) {
    for (let index = 0; index < leadContacts.length; index += 1) {
      const contact = leadContacts[index];
      const emailKey = contact.email ? `email:${String(contact.email).trim().toLowerCase()}` : '';
      const phoneKey = contact.phone ? `phone:${String(contact.phone).replace(/\D/g, '')}` : '';
      if ((emailKey && existingContactKeys.has(emailKey)) || (phoneKey && existingContactKeys.has(phoneKey))) continue;
      await clientContactModel.create({
        clientId: clientRecord.id,
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email: contact.email || '',
        phone: contact.phone || '',
        jobTitle: contact.jobTitle || '',
        gender: contact.gender || 'Other',
        notes: contact.notes || '',
        isPrimary: index === 0
      }, db);
      if (emailKey) existingContactKeys.add(emailKey);
      if (phoneKey) existingContactKeys.add(phoneKey);
    }
  } else if (primaryContactName) {
    const emailKey = current.email ? `email:${String(current.email).trim().toLowerCase()}` : '';
    const phoneKey = current.phone ? `phone:${String(current.phone).replace(/\D/g, '')}` : '';
    if ((!emailKey || !existingContactKeys.has(emailKey)) && (!phoneKey || !existingContactKeys.has(phoneKey))) {
      await clientContactModel.create({
        clientId: clientRecord.id,
        firstName: current.contactPerson || primaryContactName,
        lastName: '',
        email: current.email || '',
        phone: current.phone || '',
        jobTitle: 'Primary Contact',
        gender: 'Other',
        notes: current.notes || '',
        isPrimary: true
      }, db);
    }
  }

  let projectRecord = null;
  if (options.createProject === true) {
    projectRecord = await projectModel.create({
      clientId: clientRecord.id,
      title: String(options.projectTitle || current.requirementTitle || current.companyName || current.name || 'New Project').trim(),
      projectType: toList(current.requiredServices).join(', '),
      value: current.estimatedBudget ?? current.value ?? 0,
      startDate: current.expectedStartDate || null,
      deadline: current.expectedDeliveryDate || null,
      status: 'Active',
      billingType: current.billingType || '',
      notes: current.requirementDescription || current.requirementSummary || current.notes || '',
      labels: current.labels || [],
      assignedTo: current.assignedTo || '',
      sourceLeadId: current.id,
      attachments: current.requirementAttachments || []
    }, db);
  }

  let invoiceRecord = null;
  if (options.createDraftInvoice === true) {
    const totalVal = Number(current.estimatedBudget ?? current.value ?? 0);
    const invoiceAmount = options.invoiceAdvanceOnly !== false && totalVal > 0 ? Math.round(totalVal * 0.5) : totalVal;
    if (invoiceAmount > 0) {
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
      invoiceRecord = await invoiceModel.create({
        invoiceNumber,
        clientId: clientRecord.id,
        projectId: projectRecord?.id || null,
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        status: 'Draft',
        invoiceType: 'Standard',
        taxableAmount: invoiceAmount,
        totalAmount: invoiceAmount,
        notes: `Initial milestone advance invoice for ${projectRecord?.title || current.requirementTitle || 'project'}`,
        items: [
          {
            description: `${projectRecord?.title || current.requiredService || 'Web Development & Consulting'} (Milestone Advance)`,
            qty: 1,
            rate: invoiceAmount,
            amount: invoiceAmount
          }
        ]
      }, db);
    }
  }

  const convertedAt = new Date().toISOString();
  const convertedLead = await leadModel.update(resolvedLeadId, {
    status: 'Won',
    convertedClientId: clientRecord.id,
    convertedProjectId: projectRecord?.id || null,
    convertedAt,
    convertedBy: req?.user?.id || null,
    lastStatusChangedAt: String(current.status || '').toLowerCase() === 'won' ? current.lastStatusChangedAt : convertedAt,
    lastStatusChangedBy: String(current.status || '').toLowerCase() === 'won' ? current.lastStatusChangedBy : req?.user?.id || null,
    updatedBy: req?.user?.id || null
  }, db);

  await db.query(
    `insert into lead_conversion_mappings
      (id, lead_id, client_id, project_id, converted_by, converted_at, payload, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $6, $6)
     on conflict (lead_id)
     do update set client_id = excluded.client_id,
                   project_id = excluded.project_id,
                   converted_by = excluded.converted_by,
                   converted_at = excluded.converted_at,
                   payload = excluded.payload,
                   updated_at = excluded.updated_at`,
    [
      createId('lead-conversion'),
      resolvedLeadId,
      clientRecord.id,
      projectRecord?.id || null,
      req?.user?.id || null,
      convertedAt,
      JSON.stringify({ usedExistingClient: Boolean(options.existingClientId || options.useExistingClient), createProject: Boolean(projectRecord), createDraftInvoice: Boolean(invoiceRecord) })
    ]
  );

  await createLeadTimelineEvent(db, convertedLead, req, {
    kind: 'converted',
    title: projectRecord ? 'Lead converted to client and project' : 'Lead converted to client',
    description: `Converted by ${getActorName(req?.user)}${invoiceRecord ? ` • Generated Draft Invoice ${invoiceRecord.invoiceNumber}` : ''}`,
    meta: { clientId: clientRecord.id, projectId: projectRecord?.id || null, invoiceId: invoiceRecord?.id || null }
  });

  return { lead: convertedLead, client: clientRecord, project: projectRecord, invoice: invoiceRecord, duplicateClients };
}

async function createFollowUpActivity(db, lead, req, payload = {}) {
  const startDate = payload.followUpDate || payload.startDate || lead.followUpDate || null;
  const startTime = payload.nextFollowUpTime || payload.startTime || lead.nextFollowUpTime || '';
  return leadEventModel.create({
    leadId: lead.id,
    scopeType: 'lead',
    scopeId: lead.id,
    ownerUserId: payload.assignedTo || lead.assignedTo || req?.user?.id || null,
    visibility: 'all_team',
    eventType: 'reminder',
    title: payload.title || 'Lead follow-up',
    description: payload.followUpNote || payload.description || lead.followUpNote || '',
    startDate,
    endDate: startDate,
    startTime,
    endTime: startTime,
    color: '#f59e0b',
    payload: {
      kind: payload.kind || 'follow_up_scheduled',
      status: payload.status || 'scheduled',
      mode: payload.followUpMode || lead.followUpMode || '',
      reminder: payload.reminder || lead.reminder || '',
      priority: payload.followUpPriority || lead.followUpPriority || '',
      followUpId: payload.followUpId || null,
      actorUserId: req?.user?.id || null,
      actorName: getActorName(req?.user)
    }
  }, db);
}

async function updateLeadRecord(leadId, body, req, db, { recordFollowUp = true, auditTitle = '' } = {}) {
  const current = await findAccessibleLeadById(leadId, req, db);
  if (!current) return null;

  const pipelineId = await resolveLeadPipelineId(body || {}, current, req, db);
  let patch = getLeadPatch({ ...(body || {}), pipelineId }, current, req);
  patch = validateLeadForSave(patch, { current });
  if (String(current.assignedTo || '') !== String(patch.assignedTo || '')) {
    await assertActiveAssignee(patch.assignedTo, db);
  }

  const updated = await leadModel.update(leadId, patch, db);
  const changes = getFieldChangeSummary(current, updated);
  const statusChanged = String(current.status || '').trim() !== String(updated.status || '').trim();
  const assignmentChanged = String(current.assignedTo || '') !== String(updated.assignedTo || '');
  const followUpChanged = String(current.followUpDate || '') !== String(updated.followUpDate || '')
    || String(current.nextFollowUpTime || '') !== String(updated.nextFollowUpTime || '');

  if (statusChanged) {
    await createLeadTimelineEvent(db, updated, req, {
      kind: 'status_changed',
      title: `Status changed to ${updated.status || 'Updated'}`,
      description: `Changed from ${current.status || '-'} by ${getActorName(req.user)}`,
      meta: { previousStatus: current.status || '', nextStatus: updated.status || '', statusNote: updated.statusNote || '' }
    });
  }

  if (assignmentChanged) {
    await createLeadTimelineEvent(db, updated, req, {
      kind: 'assigned',
      title: 'Lead assignment changed',
      description: `Reassigned by ${getActorName(req.user)}`,
      meta: { previousAssigneeId: current.assignedTo || null, nextAssigneeId: updated.assignedTo || null }
    });
  }

  if (updated.followUpDate && !['Won', 'Lost', 'Not Interested', 'Invalid Lead', 'Duplicate'].includes(updated.status)) {
    const dueAt = followUpEngine.parseDateTime('', updated.followUpDate, updated.nextFollowUpTime || '09:30', 'Asia/Kolkata');
    if (dueAt) {
      await followUpEngine.ensureEntityFollowUp('Lead', updated.id, {
        title: updated.followUpNote || 'Lead follow-up',
        description: updated.followUpNote || '',
        followUpType: updated.followUpMode || 'Call',
        purpose: 'Lead follow-up',
        dueAt,
        assignedTo: updated.assignedTo || req.user?.id,
        priority: updated.followUpPriority || updated.priority || 'High',
        source: 'lead_updated'
      }, req.user, { db });
    }
  } else if (!updated.followUpDate || ['Won', 'Lost', 'Not Interested', 'Invalid Lead', 'Duplicate'].includes(updated.status)) {
    await followUpEngine.autoCloseEntityFollowUps('Lead', updated.id, 'Lead follow-up cleared or status updated', req.user, { db });
  }

  if (recordFollowUp && followUpChanged && updated.followUpDate) {
    await createFollowUpActivity(db, updated, req, { kind: current.followUpDate ? 'follow_up_rescheduled' : 'follow_up_scheduled' });
  }

  const meaningfulChanges = changes.filter((change) => !['status', 'assignedTo', 'followUpDate', 'nextFollowUpTime'].includes(change.key));
  if (meaningfulChanges.length) {
    const summary = meaningfulChanges.slice(0, 4).map((change) => change.label).join(', ');
    await createLeadTimelineEvent(db, updated, req, {
      kind: 'updated',
      title: auditTitle || 'Lead updated',
      description: `${summary} updated by ${getActorName(req.user)}`,
      meta: {
        changes: meaningfulChanges.map((change) => ({
          key: change.key,
          label: change.label,
          before: change.before,
          after: change.after
        }))
      }
    });
  }

  if (statusChanged && ['Lost', 'Not Interested'].includes(updated.status) && updated.reconnectInFuture && updated.reconnectDate) {
    await createFollowUpActivity(db, updated, req, {
      title: 'Reconnect with lost lead',
      description: updated.lostReasonNotes || updated.lostReason || '',
      followUpDate: updated.reconnectDate,
      kind: 'reconnect_scheduled',
      reminder: updated.reminder || '1 Day Before'
    });
  }

  return { current, updated, changes, statusChanged, assignmentChanged, followUpChanged };
}

function assertBulkActionPermission(user, action) {
  const permissions = action === 'assign'
    ? ['leads.assign', 'leads.write']
    : action === 'follow_up'
      ? ['leads.manage_followup', 'leads.write']
      : ['leads.write'];

  if (!permissions.some((permission) => hasPermission(user, permission))) {
    const error = new Error(`Missing permission for bulk ${action.replace('_', ' ')}`);
    error.statusCode = 403;
    throw error;
  }
}

function getBulkLeadIds(value) {
  const ids = [...new Set((Array.isArray(value) ? value : []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) throw createValidationError({ ids: 'Select at least one lead' });
  if (ids.length > 100) throw createValidationError({ ids: 'A maximum of 100 leads can be updated at once' });
  return ids;
}

async function buildLeadOptions() {
  const serviceRows = await masterItemModel.listByType('service');
  const services = serviceRows
    .filter((service) => service?.isActive !== false && String(service?.name || '').trim())
    .sort((a, b) => {
      const orderDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
      if (orderDiff !== 0) return orderDiff;
      return String(a.name || '').localeCompare(String(b.name || ''));
    })
    .map((service) => String(service.name).trim());
  const serviceOptions = [...new Set([...services, 'Other'])];

  return {
    ...LEAD_OPTIONS,
    services: serviceOptions,
    scoreRules: LEAD_SCORE_RULES
  };
}

const baseController = createCrudController(leadModel, {
  defaultOrder: 'updated_at DESC',
  onCreate: async (body, req) => getLeadPatch(body, null, req),
  onUpdate: async (body, req, current) => getLeadPatch(body, current, req)
});

const leadsController = {
  ...baseController,
  options: async (req, res, next) => {
    try {
      res.json({ success: true, data: await buildLeadOptions() });
    } catch (error) {
      next(error);
    }
  },
  duplicates: async (req, res, next) => {
    try {
      const rows = await findDuplicateLeads({
        phone: req.query.phone,
        email: req.query.email,
        excludeId: req.query.excludeId
      }, req);
      res.json({ success: true, data: rows.map((row) => sanitizeLeadForUser(row, req.user)) });
    } catch (error) {
      next(error);
    }
  },
  merge: async (req, res, next) => {
    try {
      const { primaryLeadId, duplicateLeadId, note } = req.body || {};
      if (!primaryLeadId || !duplicateLeadId) {
        return res.status(400).json({ success: false, message: 'Both primaryLeadId and duplicateLeadId are required' });
      }
      if (String(primaryLeadId) === String(duplicateLeadId)) {
        return res.status(400).json({ success: false, message: 'Cannot merge a lead into itself' });
      }

      const result = await withTransaction(async (db) => {
        const primary = await findAccessibleLeadById(primaryLeadId, req, db);
        const duplicate = await findAccessibleLeadById(duplicateLeadId, req, db);
        if (!primary || !duplicate) {
          throw new Error('One or both leads were not found');
        }

        // 1. Migrate lead_events from duplicate to primary
        await db.query(
          `UPDATE lead_events 
           SET lead_id = $1, scope_id = $1, updated_at = NOW() 
           WHERE lead_id = $2`,
          [primary.id, duplicate.id]
        );

        // 2. Migrate files / file_assets if any
        await db.query(
          `UPDATE file_assets 
           SET entity_id = $1, updated_at = NOW() 
           WHERE module_name = 'leads' AND entity_id = $2`,
          [primary.id, duplicate.id]
        );

        // 3. Migrate follow_ups if any
        await db.query(
          `UPDATE follow_ups 
           SET related_entity_id = $1, updated_at = NOW() 
           WHERE related_entity_type = 'Lead' AND related_entity_id = $2`,
          [primary.id, duplicate.id]
        );

        // 4. Update duplicate lead status to Merged
        const duplicateNote = `[Merged into ${primary.leadNumber || primary.id} on ${new Date().toLocaleDateString()}] ${note || ''}`.trim();
        await db.query(
          `UPDATE leads 
           SET status = 'Merged', 
               notes = COALESCE(notes || E'\\n', '') || $1,
               status_note = $1,
               updated_at = NOW(),
               updated_by = $2
           WHERE id = $3`,
          [duplicateNote, req.user?.id || null, duplicate.id]
        );

        // 5. Add timeline event on primary lead
        await createLeadTimelineEvent(db, primary, req, {
          kind: 'lead_merged',
          title: `Merged with Lead ${duplicate.leadNumber || duplicate.id}`,
          description: `Activities, notes, and calls from ${duplicate.name || duplicate.companyName || duplicate.leadNumber} were merged into this lead by ${getActorName(req.user)}.`,
          meta: {
            mergedFromId: duplicate.id,
            mergedFromLeadNumber: duplicate.leadNumber,
            note: note || ''
          }
        });

        const refreshedPrimary = await leadModel.findById(primary.id, db);
        return { primary: refreshedPrimary, duplicate };
      });

      res.json({
        success: true,
        message: `Lead ${result.duplicate.leadNumber || ''} successfully merged into ${result.primary.leadNumber || ''}`,
        data: sanitizeLeadForUser(result.primary, req.user)
      });
    } catch (error) {
      next(error);
    }
  },
  bulk: async (req, res, next) => {
    try {
      const ids = getBulkLeadIds(req.body?.ids);
      const action = String(req.body?.action || '').trim().toLowerCase();
      if (!['assign', 'status', 'follow_up'].includes(action)) {
        throw createValidationError({ action: 'Select assign, status, or follow-up' });
      }
      assertBulkActionPermission(req.user, action);

      const records = await withTransaction(async (db) => {
        let ownerName = '';
        if (action === 'assign') {
          if (!req.body?.assignedTo) throw createValidationError({ assignedTo: 'Select an active employee' });
          await assertActiveAssignee(req.body?.assignedTo, db);
          const assignee = await db.query(
            'select full_name, username, email from users where id = $1 and is_active = true limit 1',
            [req.body?.assignedTo]
          );
          ownerName = assignee.rows[0]?.full_name || assignee.rows[0]?.username || assignee.rows[0]?.email || '';
        }
        if (action === 'status' && !String(req.body?.status || '').trim()) {
          throw createValidationError({ status: 'Status is required' });
        }
        if (action === 'follow_up' && !req.body?.followUpDate) {
          throw createValidationError({ followUpDate: 'Follow-up date is required' });
        }

        const updatedRecords = [];
        for (const id of ids) {
          let payload;
          let options = {};
          if (action === 'assign') {
            payload = {
              assignedTo: req.body.assignedTo,
              leadOwner: req.body.leadOwner || req.body.assignedTo,
              ownerName,
              assignedTeam: req.body.assignedTeam,
              secondaryAssignees: req.body.secondaryAssignees || []
            };
          } else if (action === 'status') {
            payload = {
              status: req.body.status,
              statusNote: req.body.statusNote,
              lostReason: req.body.lostReason,
              lostReasonNotes: req.body.lostReasonNotes,
              competitorName: req.body.competitorName,
              competitorPrice: req.body.competitorPrice,
              reconnectInFuture: req.body.reconnectInFuture,
              reconnectDate: req.body.reconnectDate,
              originalLeadId: req.body.originalLeadId
            };
          } else {
            payload = {
              followUpDate: req.body.followUpDate,
              nextFollowUpTime: req.body.nextFollowUpTime || '',
              followUpMode: req.body.followUpMode || '',
              reminder: req.body.reminder || 'No Reminder',
              followUpNote: req.body.followUpNote || '',
              followUpPriority: req.body.followUpPriority || 'Medium',
              assignedTo: req.body.assignedTo || undefined
            };
            options = { recordFollowUp: false };
          }

          const result = await updateLeadRecord(id, payload, req, db, options);
          if (!result) {
            const error = new Error(`Lead ${id} was not found or is not accessible`);
            error.statusCode = 404;
            throw error;
          }
          if (action === 'follow_up') {
            await createFollowUpActivity(db, result.updated, req, req.body || {});
          }
          updatedRecords.push(result.updated);
        }
        return updatedRecords;
      });

      const eventKey = action === 'assign' ? 'assigned' : action === 'status' ? 'status_changed' : 'follow_up_scheduled';
      const title = action === 'assign' ? 'Lead assigned' : action === 'status' ? 'Lead status updated' : 'Lead follow-up scheduled';
      records.forEach((record) => {
        notifyBusinessEvent({
          moduleName: 'leads',
          eventKey,
          entity: record,
          title,
          message: `${record.contactPerson || record.name || 'Lead'} was updated in bulk.`,
          actorUserId: req.user?.id || null,
          explicitUserIds: [record.assignedTo].filter(Boolean),
          routePath: `/app/leads/${record.id}`
        }).catch(() => {});
      });

      res.json({
        success: true,
        data: records.map((record) => sanitizeLeadForUser(record, req.user)),
        count: records.length,
        action
      });
    } catch (error) {
      next(error);
    }
  },
  list: async (req, res, next) => {
    try {
      await ensureDefaultLeadPipeline();
      const {
        search, limit, offset, orderBy, pipelineId, status, source, assignedTo, leadTemperature, priority,
        requiredService, createdFrom, createdTo, followUpFrom, followUpTo, overdue, converted,
        city, state, budgetRange
      } = req.query || {};
      let rows = await leadModel.list({
        where: { pipelineId, status, source, assignedTo, leadTemperature, priority, city, state, budgetRange },
        search,
        orderBy: orderBy || 'updated_at DESC'
      });
      rows = filterLeadsByPipelineAccess(rows, req);

      if (requiredService) {
        rows = rows.filter((row) => toList(row.requiredServices).includes(String(requiredService)));
      }
      if (createdFrom) rows = rows.filter((row) => String(row.createdAt || '').slice(0, 10) >= String(createdFrom));
      if (createdTo) rows = rows.filter((row) => String(row.createdAt || '').slice(0, 10) <= String(createdTo));
      if (followUpFrom) rows = rows.filter((row) => row.followUpDate && String(row.followUpDate) >= String(followUpFrom));
      if (followUpTo) rows = rows.filter((row) => row.followUpDate && String(row.followUpDate) <= String(followUpTo));
      if (String(overdue || '').toLowerCase() === 'true') {
        const today = new Date().toISOString().slice(0, 10);
        rows = rows.filter((row) => row.followUpDate && String(row.followUpDate) < today && !['Won', 'Lost', 'Not Interested'].includes(row.status));
      }
      if (converted === 'true') rows = rows.filter((row) => Boolean(row.convertedClientId));
      if (converted === 'false') rows = rows.filter((row) => !row.convertedClientId);

      if (limit || offset) {
        const start = Number(offset || 0);
        const end = limit ? start + Number(limit) : undefined;
        rows = rows.slice(start, end);
      }

      res.json({ success: true, data: rows.map((row) => sanitizeLeadForUser(row, req.user)) });
    } catch (error) {
      next(error);
    }
  },
  getById: async (req, res, next) => {
    try {
      const record = await findAccessibleLeadById(req.params.id, req);
      if (!record) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }
      res.json({ success: true, data: sanitizeLeadForUser(record, req.user) });
    } catch (error) {
      next(error);
    }
  },
  create: async (req, res, next) => {
    try {
      const result = await withTransaction(async (db) => {
        const attachmentDraftId = String(req.body?.attachmentDraftId || '').trim();
        const pipelineId = await resolveLeadPipelineId(req.body || {}, null, req, db);
        let body = getLeadPatch({ ...(req.body || {}), pipelineId }, null, req);
        body = validateLeadForSave(body, { isCreate: true });
        await assertActiveAssignee(body.assignedTo, db);
        const duplicates = await findDuplicateLeads({ phone: body.phone, email: body.email }, req, db);
        const created = await leadModel.create(body, db);
        if (attachmentDraftId) {
          await db.query(
            `update file_assets set entity_id = $1, updated_at = now()
             where module_name = 'leads' and entity_id = $2`,
            [created.id, attachmentDraftId]
          );
        }
        await createLeadTimelineEvent(db, created, req, {
          kind: 'created',
          title: 'Lead created',
          description: `Created by ${getActorName(req.user)}`
        });
        const requestedDueAt = followUpEngine.parseDateTime(
          '',
          created.followUpDate,
          created.nextFollowUpTime || '09:30',
          'Asia/Kolkata'
        );
        const dueAt = requestedDueAt || new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const centralFollowUp = await followUpEngine.ensureEntityFollowUp('Lead', created.id, {
          title: created.followUpNote || 'New lead first call',
          description: created.followUpNote || 'Make first contact and capture requirement, budget and timeline.',
          followUpType: created.followUpMode || 'Call',
          purpose: 'First contact SLA',
          dueAt,
          assignedTo: created.assignedTo || created.leadOwner || req.user?.id,
          priority: created.followUpPriority || created.priority || 'High',
          reminderSettings: [{ channel: 'inApp', minutesBefore: 10 }, { channel: 'inApp', minutesBefore: 0 }],
          templateId: 'futpl-new-lead',
          source: 'lead_created'
        }, req.user, { db });
        const refreshed = await leadModel.findById(created.id, db);
        await createFollowUpActivity(db, refreshed, req, {
          followUpId: centralFollowUp.record?.id || null,
          kind: 'first_contact_scheduled',
          title: 'New lead first call'
        });
        await followUpEngine.handleBusinessTrigger('lead_created', 'Lead', created.id, req.user, {
          db, eventId: created.id, payload: created
        });
        return { record: refreshed, duplicates };
      });

      const record = result.record;

      notifyBusinessEvent({
        moduleName: 'leads',
        eventKey: 'created',
        entity: record,
        title: 'Lead created',
        message: `${record.name || record.companyName || 'Lead'} was created.`,
        actorUserId: req.user?.id || null,
        explicitUserIds: [record.assignedTo, record.createdBy].filter(Boolean),
        routePath: `/app/leads/${record.id}`
      }).catch(() => {});

      res.status(201).json({
        success: true,
        data: sanitizeLeadForUser(record, req.user),
        warnings: result.duplicates.length ? { duplicateLeads: result.duplicates.map((item) => sanitizeLeadForUser(item, req.user)) } : undefined
      });
    } catch (error) {
      next(error);
    }
  },
  summary: async (req, res, next) => {
    try {
      const record = await findAccessibleLeadById(req.params.id, req);
      if (!record) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }
      const result = await buildLeadSummary(record.id);
      if (!result) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }
      const hasRecordingPermission = hasPermission(req.user, 'leads.view_call_recording');
      const sanitizedTimeline = (result.timeline || []).map((item) => {
        if (hasRecordingPermission) return item;
        const kind = String(item.kind || '').toLowerCase();
        const title = String(item.title || '').toLowerCase();
        if (kind === 'call' || kind === 'call_logged' || title.includes('call')) {
          const sanitizedMeta = { ...(item.meta || {}) };
          delete sanitizedMeta.callRecordingUrl;
          delete sanitizedMeta.recordingFile;
          return {
            ...item,
            meta: sanitizedMeta,
            payload: sanitizedMeta,
            attachments: (Array.isArray(item.attachments) ? item.attachments : []).filter((f) => f?.kind !== 'call_recording')
          };
        }
        return item;
      });
      res.json({
        success: true,
        data: {
          ...result,
          lead: sanitizeLeadForUser(result.lead, req.user),
          events: (result.events || []).map((event) => sanitizeLeadEventForUser(event, req.user)),
          timeline: sanitizedTimeline
        }
      });
    } catch (error) {
      next(error);
    }
  },
  update: async (req, res, next) => {
    try {
      const updateResult = await withTransaction((db) => updateLeadRecord(req.params.id, req.body || {}, req, db));
      const record = updateResult?.updated || null;

      if (!record) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      notifyBusinessEvent({
        moduleName: 'leads',
        eventKey: 'updated',
        entity: record,
        title: 'Lead updated',
        message: `${record.name || record.companyName || 'Lead'} was updated.`,
        actorUserId: req.user?.id || null,
        explicitUserIds: [record.assignedTo, record.createdBy].filter(Boolean),
        routePath: `/app/leads/${record.id}`
      }).catch(() => {});

      res.json({ success: true, data: sanitizeLeadForUser(record, req.user) });
    } catch (error) {
      next(error);
    }
  },
  convert: async (req, res, next) => {
    try {
      const lead = await findAccessibleLeadById(req.params.id, req);
      if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
      assertConversionPermissions(req.user, req.body || {});
      const settings = await getSettings();
      const converted = await withTransaction(async (db) => convertLeadRecord(lead.id, settings, db, req, req.body || {}));
      if (!converted) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      notifyBusinessEvent({
        moduleName: 'leads',
        eventKey: 'converted',
        entity: converted.client,
        title: 'Lead converted',
        message: `${converted.lead?.name || converted.lead?.companyName || 'Lead'} was converted to a client.`,
        severity: 'success',
        actorUserId: req.user?.id || null,
        explicitUserIds: [converted.lead?.assignedTo, converted.lead?.createdBy].filter(Boolean),
        routePath: `/app/clients/${converted.client.id}`
      }).catch(() => {});

      return res.json({
        success: true,
        data: converted.client,
        convertedLeadId: converted.lead?.id || lead.id,
        clientId: converted.client.id,
        projectId: converted.project?.id || null,
        invoiceId: converted.invoice?.id || null,
        deletedLead: false,
        alreadyConverted: Boolean(converted.alreadyConverted)
      });
    } catch (error) {
      next(error);
    }
  },
  conversionPreview: async (req, res, next) => {
    try {
      if (!hasPermission(req.user, 'clients.read') && !hasPermission(req.user, 'clients.write')) {
        const error = new Error('Client access permission is required for lead conversion');
        error.statusCode = 403;
        throw error;
      }
      const lead = await findAccessibleLeadById(req.params.id, req);
      if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
      const duplicateClients = await findDuplicateClients(lead);
      res.json({
        success: true,
        data: {
          lead: sanitizeLeadForUser(lead, req.user),
          duplicateClients: duplicateClients.map(toClientMatch),
          projectDefaults: {
            title: lead.requirementTitle || lead.companyName || lead.name || '',
            createProject: false
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },
  history: async (req, res, next) => {
    try {
      const lead = await findAccessibleLeadById(req.params.id, req);
      if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
      const events = await leadEventModel.list({ where: { leadId: lead.id }, orderBy: 'created_at DESC' });
      res.json({ success: true, data: events.map((event) => sanitizeLeadEventForUser(event, req.user)) });
    } catch (error) {
      next(error);
    }
  },
  addFollowUp: async (req, res, next) => {
    try {
      const result = await withTransaction(async (db) => {
        const lead = await findAccessibleLeadById(req.params.id, req, db);
        if (!lead) return null;
        const followUpDate = req.body?.followUpDate || req.body?.startDate;
        if (!followUpDate) throw createValidationError({ followUpDate: 'Follow-up date is required' });
        await assertActiveAssignee(req.body?.assignedTo || lead.assignedTo, db);
        const updatedResult = await updateLeadRecord(lead.id, {
          followUpDate,
          nextFollowUpTime: req.body?.nextFollowUpTime || req.body?.startTime || '',
          followUpMode: req.body?.followUpMode || '',
          reminder: req.body?.reminder || 'No Reminder',
          followUpNote: req.body?.followUpNote || req.body?.description || '',
          followUpPriority: req.body?.followUpPriority || 'Medium',
          assignedTo: req.body?.assignedTo || lead.assignedTo
        }, req, db, { recordFollowUp: false });
        const dueAt = followUpEngine.parseDateTime(
          req.body?.dueAt,
          followUpDate,
          req.body?.nextFollowUpTime || req.body?.startTime || '09:30',
          req.body?.timezone || 'Asia/Kolkata'
        );
        const central = await followUpEngine.createFollowUp({
          relatedEntityType: 'Lead',
          relatedEntityId: lead.id,
          title: req.body?.title || 'Lead follow-up',
          description: req.body?.followUpNote || req.body?.description || '',
          followUpType: req.body?.followUpMode || 'Call',
          purpose: req.body?.purpose || 'Lead follow-up',
          dueAt,
          priority: req.body?.followUpPriority || 'Medium',
          assignedTo: req.body?.assignedTo || lead.assignedTo,
          reminderSettings: req.body?.reminderSettings || [],
          expectedOutcome: req.body?.expectedOutcome || '',
          nextAction: req.body?.nextAction || ''
        }, req.user, { db });
        const event = await createFollowUpActivity(db, updatedResult.updated, req, { ...(req.body || {}), followUpId: central.record.id });
        return { lead: updatedResult.updated, event, followUp: central.record, warnings: central.warnings };
      });
      if (!result) return res.status(404).json({ success: false, message: 'Lead not found' });

      notifyBusinessEvent({
        moduleName: 'leads',
        eventKey: 'follow_up_scheduled',
        entity: result.lead,
        title: 'Lead follow-up scheduled',
        message: `${result.lead.contactPerson || result.lead.name || 'Lead'} has a follow-up scheduled.`,
        actorUserId: req.user?.id || null,
        explicitUserIds: [result.lead.assignedTo].filter(Boolean),
        routePath: `/app/leads/${result.lead.id}`
      }).catch(() => {});
      res.status(201).json({ success: true, data: result.event, followUp: result.followUp, warnings: result.warnings });
    } catch (error) {
      next(error);
    }
  },
  updateFollowUp: async (req, res, next) => {
    try {
      const result = await withTransaction(async (db) => {
        const lead = await findAccessibleLeadById(req.params.id, req, db);
        if (!lead) return null;
        const currentEvent = await leadEventModel.findById(req.params.eventId, db);
        if (!currentEvent || String(currentEvent.leadId) !== String(lead.id) || String(currentEvent.eventType).toLowerCase() !== 'reminder') {
          throw createValidationError({ followUp: 'Follow-up record was not found' });
        }
        const action = String(req.body?.action || req.body?.status || 'rescheduled').trim().toLowerCase();
        const nextPayload = {
          ...(currentEvent.payload || {}),
          status: action === 'complete' ? 'completed' : action === 'cancel' ? 'cancelled' : 'scheduled',
          actionAt: new Date().toISOString(),
          actionBy: req.user?.id || null
        };
        const eventPatch = { payload: nextPayload };
        if (action === 'reschedule' || action === 'rescheduled') {
          const followUpDate = req.body?.followUpDate || req.body?.startDate;
          if (!followUpDate) throw createValidationError({ followUpDate: 'A new follow-up date is required' });
          eventPatch.startDate = followUpDate;
          eventPatch.endDate = followUpDate;
          eventPatch.startTime = req.body?.nextFollowUpTime || req.body?.startTime || '';
          eventPatch.endTime = eventPatch.startTime;
          await updateLeadRecord(lead.id, {
            followUpDate,
            nextFollowUpTime: eventPatch.startTime,
            followUpNote: req.body?.followUpNote ?? lead.followUpNote,
            reminder: req.body?.reminder ?? lead.reminder
          }, req, db, { recordFollowUp: false });
        } else if (String(lead.followUpDate || '') === String(currentEvent.startDate || '')) {
          await leadModel.update(lead.id, { followUpDate: null, nextFollowUpTime: '', updatedBy: req.user?.id || null }, db);
        }
        const updatedEvent = await leadEventModel.update(currentEvent.id, eventPatch, db);
        const kind = action.startsWith('complete') ? 'follow_up_completed' : action.startsWith('cancel') ? 'follow_up_cancelled' : 'follow_up_rescheduled';
        await createLeadTimelineEvent(db, lead, req, {
          kind,
          title: kind.split('_').map((item) => item[0].toUpperCase() + item.slice(1)).join(' '),
          description: `Follow-up ${nextPayload.status} by ${getActorName(req.user)}`,
          meta: { followUpId: currentEvent.id, status: nextPayload.status }
        });
        return updatedEvent;
      });
      if (!result) return res.status(404).json({ success: false, message: 'Lead not found' });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
  addActivity: async (req, res, next) => {
    try {
      const lead = await findAccessibleLeadById(req.params.id, req);
      if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
      const eventType = String(req.body?.eventType || 'event').trim().toLowerCase();
      if (!['event', 'email', 'whatsapp', 'quotation', 'meeting'].includes(eventType)) {
        throw createValidationError({ eventType: 'Unsupported activity type' });
      }
      const event = await leadEventModel.create({
        ...req.body,
        leadId: lead.id,
        scopeType: 'lead',
        scopeId: lead.id,
        ownerUserId: req.user?.id || null,
        visibility: req.body?.visibility || 'all_team',
        eventType,
        title: String(req.body?.title || `${eventType} logged`).trim(),
        description: String(req.body?.description || '').trim()
      });
      res.status(201).json({ success: true, data: sanitizeLeadEventForUser(event, req.user) });
    } catch (error) {
      next(error);
    }
  },
  addNote: async (req, res, next) => {
    try {
      const lead = await findAccessibleLeadById(req.params.id, req);
      if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
      const description = String(req.body?.description || req.body?.note || '').trim();
      if (!description) throw createValidationError({ note: 'Note is required' });
      const event = await leadEventModel.create({
        leadId: lead.id,
        scopeType: 'lead',
        scopeId: lead.id,
        ownerUserId: req.user?.id || null,
        visibility: req.body?.visibility || 'all_team',
        eventType: 'note',
        title: String(req.body?.title || 'Lead note').trim(),
        description,
        labels: req.body?.labels || []
      });
      res.status(201).json({ success: true, data: event });
    } catch (error) {
      next(error);
    }
  },
  logCall: async (req, res, next) => {
    try {
      const lead = await findAccessibleLeadById(req.params.id, req);
      if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
      const callType = String(req.body?.callType || '').trim();
      const callOutcome = String(req.body?.callOutcome || '').trim();
      if (!LEAD_OPTIONS.callTypes.includes(callType)) throw createValidationError({ callType: 'Select a valid call type' });
      if (callOutcome && !LEAD_OPTIONS.callOutcomes.includes(callOutcome)) throw createValidationError({ callOutcome: 'Select a valid call outcome' });
      if ((req.body?.callRecordingUrl || req.body?.recordingFile) && !hasPermission(req.user, 'leads.view_call_recording')) {
        const error = new Error('Call recording permission is required');
        error.statusCode = 403;
        throw error;
      }
      const callDateTime = req.body?.callDateTime ? new Date(req.body.callDateTime) : new Date();
      if (Number.isNaN(callDateTime.getTime())) throw createValidationError({ callDateTime: 'Enter a valid call date and time' });
      const event = await leadEventModel.create({
        leadId: lead.id,
        scopeType: 'lead',
        scopeId: lead.id,
        ownerUserId: req.user?.id || null,
        visibility: 'all_team',
        eventType: 'call',
        title: `${callType} call${callOutcome ? ` - ${callOutcome}` : ''}`,
        description: String(req.body?.callNotes || '').trim(),
        startDate: callDateTime.toISOString().slice(0, 10),
        startTime: callDateTime.toTimeString().slice(0, 5),
        endDate: callDateTime.toISOString().slice(0, 10),
        attachments: req.body?.attachments || [],
        payload: {
          kind: 'call_logged',
          callType,
          callOutcome,
          callDuration: Number(req.body?.callDuration || 0),
          callerNumber: normalizePhone(req.body?.callerNumber || lead.phone),
          callRecordingUrl: req.body?.callRecordingUrl || '',
          recordingFile: req.body?.recordingFile || null,
          consentConfirmed: Boolean(req.body?.consentConfirmed),
          actorUserId: req.user?.id || null,
          actorName: getActorName(req.user)
        }
      });
      res.status(201).json({ success: true, data: sanitizeLeadEventForUser(event, req.user) });
    } catch (error) {
      next(error);
    }
  },
  changeStatus: async (req, res, next) => {
    try {
      const result = await withTransaction((db) => updateLeadRecord(req.params.id, req.body || {}, req, db));
      if (!result) return res.status(404).json({ success: false, message: 'Lead not found' });
      notifyBusinessEvent({
        moduleName: 'leads',
        eventKey: 'status_changed',
        entity: result.updated,
        title: 'Lead status updated',
        message: `${result.updated.contactPerson || result.updated.name || 'Lead'} moved to ${result.updated.status}.`,
        actorUserId: req.user?.id || null,
        explicitUserIds: [result.updated.assignedTo].filter(Boolean),
        routePath: `/app/leads/${result.updated.id}`
      }).catch(() => {});
      res.json({ success: true, data: sanitizeLeadForUser(result.updated, req.user) });
    } catch (error) {
      next(error);
    }
  },
  assign: async (req, res, next) => {
    try {
      const result = await withTransaction(async (db) => {
        const assigneeResult = await db.query('select full_name, username, email from users where id = $1 and is_active = true limit 1', [req.body?.assignedTo]);
        return updateLeadRecord(req.params.id, {
          assignedTo: req.body?.assignedTo,
          leadOwner: req.body?.leadOwner || req.body?.assignedTo,
          ownerName: assigneeResult.rows[0]?.full_name || assigneeResult.rows[0]?.username || assigneeResult.rows[0]?.email || '',
          assignedTeam: req.body?.assignedTeam,
          secondaryAssignees: req.body?.secondaryAssignees || []
        }, req, db);
      });
      if (!result) return res.status(404).json({ success: false, message: 'Lead not found' });
      notifyBusinessEvent({
        moduleName: 'leads',
        eventKey: 'assigned',
        entity: result.updated,
        title: 'Lead assigned',
        message: `${result.updated.contactPerson || result.updated.name || 'Lead'} was assigned to you.`,
        actorUserId: req.user?.id || null,
        explicitUserIds: [result.updated.assignedTo].filter(Boolean),
        routePath: `/app/leads/${result.updated.id}`
      }).catch(() => {});
      res.json({ success: true, data: sanitizeLeadForUser(result.updated, req.user) });
    } catch (error) {
      next(error);
    }
  },
  markWon: async (req, res, next) => {
    try {
      const result = await withTransaction((db) => updateLeadRecord(req.params.id, { ...req.body, status: 'Won' }, req, db));
      if (!result) return res.status(404).json({ success: false, message: 'Lead not found' });
      res.json({ success: true, data: sanitizeLeadForUser(result.updated, req.user) });
    } catch (error) {
      next(error);
    }
  },
  markLost: async (req, res, next) => {
    try {
      const result = await withTransaction((db) => updateLeadRecord(req.params.id, { ...req.body, status: req.body?.status === 'Not Interested' ? 'Not Interested' : 'Lost' }, req, db));
      if (!result) return res.status(404).json({ success: false, message: 'Lead not found' });
      res.json({ success: true, data: sanitizeLeadForUser(result.updated, req.user) });
    } catch (error) {
      next(error);
    }
  },
  reopen: async (req, res, next) => {
    try {
      const updated = await withTransaction(async (db) => {
        const result = await updateLeadRecord(req.params.id, { ...req.body, status: req.body?.status || 'Follow-up' }, req, db);
        if (!result) return null;
        const reopenedAt = new Date().toISOString();
        const record = await leadModel.update(result.updated.id, { reopenedAt, reopenedBy: req.user?.id || null, updatedBy: req.user?.id || null }, db);
        await createLeadTimelineEvent(db, record, req, {
          kind: 'reopened',
          title: 'Lead reopened',
          description: `Reopened by ${getActorName(req.user)}`,
          meta: { previousStatus: result.current.status, nextStatus: record.status }
        });
        return record;
      });
      if (!updated) return res.status(404).json({ success: false, message: 'Lead not found' });
      res.json({ success: true, data: sanitizeLeadForUser(updated, req.user) });
    } catch (error) {
      next(error);
    }
  },
  remove: async (req, res, next) => {
    try {
      const lead = await findAccessibleLeadById(req.params.id, req);
      if (lead?.convertedClientId) {
        return res.status(409).json({ success: false, message: 'Converted leads cannot be deleted' });
      }
      const ok = await leadModel.remove(req.params.id);
      if (!ok) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }
      res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
      next(error);
    }
  },

  globalSearch: async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q || q.length < 2) {
        return res.json({ success: true, data: { leads: [], clients: [], invoices: [], projects: [] } });
      }
      const pattern = `%${q.toLowerCase()}%`;
      const [leadsRes, clientsRes, invoicesRes, projectsRes] = await Promise.all([
        query(
          `SELECT id, name, company_name, phone, email, status, lead_number 
           FROM leads 
           WHERE lower(coalesce(name, '')) LIKE $1 
              OR lower(coalesce(company_name, '')) LIKE $1 
              OR lower(coalesce(phone, '')) LIKE $1 
              OR lower(coalesce(email, '')) LIKE $1 
              OR lower(coalesce(lead_number, '')) LIKE $1 
           ORDER BY updated_at DESC LIMIT 5`,
          [pattern]
        ),
        query(
          `SELECT id, name, company_name, mobile, email, status 
           FROM clients 
           WHERE lower(coalesce(name, '')) LIKE $1 
              OR lower(coalesce(company_name, '')) LIKE $1 
              OR lower(coalesce(mobile, '')) LIKE $1 
              OR lower(coalesce(email, '')) LIKE $1 
           ORDER BY updated_at DESC LIMIT 5`,
          [pattern]
        ),
        query(
          `SELECT id, invoice_number, total_amount, status, invoice_date 
           FROM invoices 
           WHERE lower(coalesce(invoice_number, '')) LIKE $1 
              OR lower(coalesce(id, '')) LIKE $1 
           ORDER BY updated_at DESC LIMIT 5`,
          [pattern]
        ),
        query(
          `SELECT id, title, project_type, status, value 
           FROM projects 
           WHERE lower(coalesce(title, '')) LIKE $1 
              OR lower(coalesce(id, '')) LIKE $1 
           ORDER BY updated_at DESC LIMIT 5`,
          [pattern]
        )
      ]);

      res.json({
        success: true,
        data: {
          leads: leadsRes.rows.map((row) => ({
            id: row.id,
            title: row.name || row.company_name,
            subtitle: `${row.lead_number || ''} • ${row.phone || row.email || ''} • ${row.status || ''}`.trim(),
            type: 'Lead',
            path: `/app/leads/${row.id}`
          })),
          clients: clientsRes.rows.map((row) => ({
            id: row.id,
            title: row.company_name || row.name,
            subtitle: `${row.mobile || row.email || ''} • ${row.status || ''}`.trim(),
            type: 'Client',
            path: `/app/clients/${row.id}`
          })),
          invoices: invoicesRes.rows.map((row) => ({
            id: row.id,
            title: `Invoice #${row.invoice_number || row.id}`,
            subtitle: `₹${Number(row.total_amount || 0).toLocaleString('en-IN')} • ${row.status || ''}`,
            type: 'Invoice',
            path: `/app/invoices/${row.id}`
          })),
          projects: projectsRes.rows.map((row) => ({
            id: row.id,
            title: row.title,
            subtitle: `${row.project_type || 'Project'} • ${row.status || ''}`,
            type: 'Project',
            path: `/app/projects/${row.id}`
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  },

  captureWebhookLead: async (req, res, next) => {
    try {
      const settings = await getSettings();
      const configuredKey = settings?.leadWebhookKey || process.env.LEAD_WEBHOOK_KEY || 'webitof-crm-webhook-secret';
      const providedKey = req.query.key || req.headers['x-crm-webhook-key'] || req.body?.key;

      if (!providedKey || String(providedKey).trim() !== String(configuredKey).trim()) {
        return res.status(401).json({ success: false, message: 'Invalid or missing Webhook API key' });
      }

      const raw = req.body || {};
      const name = String(raw.name || raw.contactPerson || raw.fullName || raw.firstName || 'Web Lead').trim();
      const phone = String(raw.phone || raw.mobile || raw.contactNumber || '').trim();
      const email = String(raw.email || raw.emailAddress || '').trim();
      const companyName = String(raw.companyName || raw.company || raw.organization || '').trim();
      const requirementSummary = String(raw.requirementSummary || raw.message || raw.requirement || raw.notes || '').trim();
      const source = String(raw.source || 'Website Webhook').trim();
      const requiredServices = Array.isArray(raw.requiredServices)
        ? raw.requiredServices
        : (raw.service || raw.requiredService ? [raw.service || raw.requiredService] : ['Website Development']);
      const estimatedBudget = Number(raw.estimatedBudget || raw.budget || 0) || null;

      if (!phone && !email) {
        return res.status(400).json({ success: false, message: 'At least phone or email is required to capture lead' });
      }

      // Check duplicates
      const duplicates = await findDuplicateLeads({ phone, email });
      if (duplicates.length > 0) {
        const existingLead = duplicates[0];
        // Log event to existing lead
        await createLeadTimelineEvent(null, existingLead, { user: null }, {
          kind: 'webhook_inquiry',
          title: 'New Webhook Inquiry Received',
          description: `Repeat contact form submission from ${source}: ${requirementSummary || 'No message'}`,
          meta: { rawInput: raw }
        });
        return res.json({
          success: true,
          message: 'Lead inquiry linked to existing lead record',
          leadId: existingLead.id,
          isDuplicate: true
        });
      }

      // Get system admin user
      const adminUserResult = await query(
        `SELECT u.id FROM users u 
         WHERE u.is_active = true 
         ORDER BY u.created_at ASC LIMIT 1`
      );
      const defaultAssigneeId = adminUserResult.rows[0]?.id || null;

      const leadPayload = {
        name,
        contactPerson: name,
        companyName,
        phone,
        email,
        source,
        requiredServices,
        requirementSummary,
        requirementDescription: requirementSummary,
        estimatedBudget,
        status: 'New',
        priority: 'High',
        assignedTo: defaultAssigneeId
      };

      const result = await withTransaction(async (db) => {
        const pipelineId = await resolveLeadPipelineId(leadPayload, null, { user: { id: defaultAssigneeId } }, db);
        let body = getLeadPatch({ ...leadPayload, pipelineId }, null, { user: { id: defaultAssigneeId } });
        body = validateLeadForSave(body, { isCreate: true });
        const created = await leadModel.create(body, db);

        await createLeadTimelineEvent(db, created, { user: { id: defaultAssigneeId } }, {
          kind: 'webhook_captured',
          title: 'Lead Captured via Webhook',
          description: `Captured automatically from ${source}`,
          meta: { rawInput: raw }
        });

        // Ensure first contact SLA follow up
        const dueAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await followUpEngine.ensureEntityFollowUp('Lead', created.id, {
          title: 'New web lead initial follow-up',
          description: requirementSummary || 'Contact lead and qualify requirements.',
          followUpType: 'Call',
          purpose: 'First contact SLA',
          dueAt,
          assignedTo: defaultAssigneeId,
          priority: 'High',
          source: 'webhook_created'
        }, { id: defaultAssigneeId }, { db });

        return created;
      });

      res.status(201).json({
        success: true,
        message: 'Lead captured successfully',
        data: {
          leadId: result.id,
          leadNumber: result.leadNumber,
          name: result.name
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = leadsController;
module.exports.convertLeadRecord = convertLeadRecord;
