const leadEventModel = require('../models/leadEvent.model');
const leadModel = require('../models/lead.model');
const { withTransaction } = require('../config/db');
const { cleanupRemovedAttachments } = require('../services/attachmentCleanup.service');
const { notifyBusinessEvent } = require('../services/notification.service');
const { ensureInvoiceForApprovedQuotation } = require('../services/quotationInvoice.service');
const {
  getEventAttachmentContext,
  isVisibleToUser,
  normalizeEventPayload
} = require('../services/eventNormalization.service');
const { DEFAULT_PIPELINE_ID, canAccessPipeline, userHasAllPipelineAccess } = require('../services/leadPipelineAccess.service');
const { hasPermission } = require('../middlewares/auth');
const followUpEngine = require('../services/followUpEngine.service');

async function syncQuotationFollowUps(result, req, db) {
  const quotation = result?.quotation;
  if (String(quotation?.eventType || '').toLowerCase() !== 'quotation') return result;
  const status = String(quotation.status || quotation.payload?.status || '').trim().toLowerCase();
  const trigger = status === 'sent'
    ? 'quotation_sent'
    : status === 'viewed'
      ? 'quotation_viewed'
      : status === 'approved'
        ? 'quotation_approved'
        : status === 'rejected'
          ? 'quotation_rejected'
          : '';
  if (trigger) {
    await followUpEngine.handleBusinessTrigger(trigger, 'Quotation', quotation.id, req.user, { db, payload: { leadId: quotation.leadId || quotation.scopeId } });
  }
  if (result?.invoice) {
    await followUpEngine.ensureEntityFollowUp('Invoice', result.invoice.id, {
      title: `Payment follow-up for ${result.invoice.invoiceNumber}`,
      followUpType: 'Payment follow-up',
      purpose: 'Advance payment collection',
      dueAt: followUpEngine.parseDateTime('', result.invoice.dueDate, '10:00', 'Asia/Kolkata'),
      priority: Number(result.invoice.totalAmount || 0) >= 250000 ? 'Critical' : 'High',
      priorityContext: { outstandingAmount: result.invoice.totalAmount },
      assignedTo: quotation.ownerUserId || req.user?.id,
      templateId: 'futpl-payment',
      source: 'quotation_approved'
    }, req.user, { db });
  }
  return result;
}

function sanitizeEventForUser(event, user) {
  if (!event || hasPermission(user, 'leads.view_call_recording')) return event;
  if (String(event.eventType || '').toLowerCase() !== 'call') return event;
  const payload = { ...(event.payload || {}) };
  delete payload.callRecordingUrl;
  delete payload.recordingFile;
  return {
    ...event,
    callRecordingUrl: undefined,
    recordingFile: undefined,
    payload,
    attachments: (Array.isArray(event.attachments) ? event.attachments : []).filter((file) => file?.kind !== 'call_recording')
  };
}

function isAuditEvent(event) {
  return String(event?.eventType || '').toLowerCase() === 'system' || String(event?.payload?.kind || event?.kind || '').startsWith('status_');
}

function isLeadScope(payload = {}) {
  const scopeType = String(payload.scopeType || '').trim().toLowerCase();
  const leadId = String(payload.leadId || payload.scopeId || '').trim();
  return scopeType === 'lead' || Boolean(leadId);
}

function forbiddenPipelineError() {
  const error = new Error('You do not have access to this lead pipeline');
  error.statusCode = 403;
  return error;
}

function getEventLeadId(event = {}) {
  return event.leadId || (String(event.scopeType || '').toLowerCase() === 'lead' ? event.scopeId : '');
}

async function canAccessLeadId(leadId, req) {
  if (!leadId) return false;
  const lead = await leadModel.findById(leadId);
  return Boolean(lead && canAccessPipeline(req?.user, lead.pipelineId || DEFAULT_PIPELINE_ID));
}

async function assertEventPipelineAccess(event = {}, req) {
  const leadId = getEventLeadId(event);
  const ok = await canAccessLeadId(leadId, req);
  if (!ok) throw forbiddenPipelineError();
}

async function filterEventsByPipelineAccess(rows = [], req) {
  if (userHasAllPipelineAccess(req?.user)) return rows;
  const result = [];
  for (const event of rows) {
    if (await canAccessLeadId(getEventLeadId(event), req)) {
      result.push(event);
    }
  }
  return result;
}

async function list(req, res, next) {
  try {
    const { scopeType, scopeId, eventType, search } = req.query || {};
    let rows = await leadEventModel.list({
      where: {
        ...(scopeType ? { scopeType } : {}),
        ...(scopeId ? { scopeId } : {}),
        ...(eventType ? { eventType: String(eventType).trim().toLowerCase() } : {})
      },
      search,
      orderBy: 'coalesce(start_date, end_date, created_at) DESC, updated_at DESC'
    });

    rows = rows.filter((event) => isVisibleToUser(event, req.user));
    rows = await filterEventsByPipelineAccess(rows, req);
    res.json({ success: true, data: rows.map((event) => sanitizeEventForUser(event, req.user)) });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const record = await leadEventModel.findById(req.params.id);
    if (!record || !isVisibleToUser(record, req.user)) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    await assertEventPipelineAccess(record, req);
    res.json({ success: true, data: sanitizeEventForUser(record, req.user) });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const rawBody = req.body || {};
    const body = normalizeEventPayload(rawBody, req, { defaultScopeType: 'lead' });
    if (!isLeadScope(body)) {
      return res.status(400).json({ success: false, message: 'Lead scope is required for this record' });
    }
    await assertEventPipelineAccess(body, req);
    const result = await withTransaction(async (db) => {
      const created = await leadEventModel.create({
        ...body,
        scopeType: 'lead',
        scopeId: body.scopeId || body.leadId || null,
        leadId: body.scopeId || body.leadId || null
      }, db);
      const result = await ensureInvoiceForApprovedQuotation({ event: created, req, db });
      return syncQuotationFollowUps(result, req, db);
    });
    const record = result.quotation;
    notifyBusinessEvent({
      moduleName: 'lead-events',
      eventKey: 'created',
      entity: record,
      title: 'Lead activity created',
      message: record.title || 'A lead activity was created.',
      actorUserId: req.user?.id || null,
      explicitUserIds: [record.ownerUserId].filter(Boolean),
      routePath: `/app/leads/${record.leadId || record.scopeId || ''}`
    }).catch(() => {});
    if (result.created && result.invoice) {
      notifyBusinessEvent({
        moduleName: 'invoices',
        eventKey: 'created_from_quotation',
        entity: result.invoice,
        title: 'Invoice created from approved quotation',
        message: `${result.invoice.invoiceNumber} was created and payment follow-up was scheduled.`,
        severity: 'success',
        actorUserId: req.user?.id || null,
        explicitUserIds: [record.ownerUserId].filter(Boolean),
        routePath: `/app/invoices/${result.invoice.id}`
      }).catch(() => {});
    }
    res.status(201).json({
      success: true,
      data: record,
      automation: {
        invoice: result.invoice,
        reminder: result.reminder,
        invoiceCreated: result.created
      }
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const current = await leadEventModel.findById(req.params.id);
    if (!current || !isVisibleToUser(current, req.user)) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    await assertEventPipelineAccess(current, req);
    if (isAuditEvent(current)) {
      return res.status(403).json({ success: false, message: 'Audit events are immutable' });
    }

    const body = normalizeEventPayload({ ...current, ...(req.body || {}) }, req, { defaultScopeType: 'lead' });
    if (!isLeadScope(body)) {
      return res.status(400).json({ success: false, message: 'Lead scope is required for this record' });
    }
    await assertEventPipelineAccess(body, req);

    const result = await withTransaction(async (db) => {
      const updated = await leadEventModel.update(req.params.id, {
        ...body,
        scopeType: 'lead',
        scopeId: body.scopeId || body.leadId || current.scopeId || current.leadId || null,
        leadId: body.scopeId || body.leadId || current.scopeId || current.leadId || null
      }, db);
      const result = await ensureInvoiceForApprovedQuotation({ event: updated, req, db });
      return syncQuotationFollowUps(result, req, db);
    });
    const record = result.quotation;

    await cleanupRemovedAttachments(current.attachments, record.attachments, getEventAttachmentContext(record));
    notifyBusinessEvent({
      moduleName: 'lead-events',
      eventKey: 'updated',
      entity: record,
      title: 'Lead activity updated',
      message: record.title || 'A lead activity was updated.',
      actorUserId: req.user?.id || null,
      explicitUserIds: [record.ownerUserId].filter(Boolean),
      routePath: `/app/leads/${record.leadId || record.scopeId || ''}`
    }).catch(() => {});
    if (result.created && result.invoice) {
      notifyBusinessEvent({
        moduleName: 'invoices',
        eventKey: 'created_from_quotation',
        entity: result.invoice,
        title: 'Invoice created from approved quotation',
        message: `${result.invoice.invoiceNumber} was created and payment follow-up was scheduled.`,
        severity: 'success',
        actorUserId: req.user?.id || null,
        explicitUserIds: [record.ownerUserId].filter(Boolean),
        routePath: `/app/invoices/${result.invoice.id}`
      }).catch(() => {});
    }
    res.json({
      success: true,
      data: record,
      automation: {
        invoice: result.invoice,
        reminder: result.reminder,
        invoiceCreated: result.created
      }
    });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const current = await leadEventModel.findById(req.params.id);
    if (!current || !isVisibleToUser(current, req.user)) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    await assertEventPipelineAccess(current, req);
    if (isAuditEvent(current)) {
      return res.status(403).json({ success: false, message: 'Audit events cannot be deleted' });
    }
    const ok = await leadEventModel.remove(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    await cleanupRemovedAttachments(current.attachments, [], getEventAttachmentContext(current));
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove
};
