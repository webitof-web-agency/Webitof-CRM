const leadEventModel = require('../models/leadEvent.model');
const leadModel = require('../models/lead.model');
const { cleanupRemovedAttachments } = require('../services/attachmentCleanup.service');
const { notifyBusinessEvent } = require('../services/notification.service');
const {
  getEventAttachmentContext,
  isVisibleToUser,
  normalizeEventPayload
} = require('../services/eventNormalization.service');
const { DEFAULT_PIPELINE_ID, canAccessPipeline, userHasAllPipelineAccess } = require('../services/leadPipelineAccess.service');

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
    const { scopeType, scopeId, search } = req.query || {};
    let rows = await leadEventModel.list({
      where: {
        ...(scopeType ? { scopeType } : {}),
        ...(scopeId ? { scopeId } : {})
      },
      search,
      orderBy: 'coalesce(start_date, end_date, created_at) DESC, updated_at DESC'
    });

    rows = rows.filter((event) => isVisibleToUser(event, req.user));
    rows = await filterEventsByPipelineAccess(rows, req);
    res.json({ success: true, data: rows });
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
    res.json({ success: true, data: record });
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
    const record = await leadEventModel.create({
      ...body,
      scopeType: 'lead',
      scopeId: body.scopeId || body.leadId || null,
      leadId: body.scopeId || body.leadId || null
    });
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
    res.status(201).json({ success: true, data: record });
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

    const body = normalizeEventPayload({ ...current, ...(req.body || {}) }, req, { defaultScopeType: 'lead' });
    if (!isLeadScope(body)) {
      return res.status(400).json({ success: false, message: 'Lead scope is required for this record' });
    }
    await assertEventPipelineAccess(body, req);

    const record = await leadEventModel.update(req.params.id, {
      ...body,
      scopeType: 'lead',
      scopeId: body.scopeId || body.leadId || current.scopeId || current.leadId || null,
      leadId: body.scopeId || body.leadId || current.scopeId || current.leadId || null
    });

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
    res.json({ success: true, data: record });
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
