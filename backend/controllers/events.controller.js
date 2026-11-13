const leadEventModel = require('../models/leadEvent.model');
const leadModel = require('../models/lead.model');
const { canAccessLead } = require('../services/leadPipelineAccess.service');
const { hasPermission, requirePermission } = require('../middlewares/auth');
const { cleanupRemovedAttachments, rebindFileAssetsToEntity } = require('../services/attachmentCleanup.service');
const {
  getEventAttachmentContext,
  isEventRecord,
  isVisibleToUser,
  normalizeEventPayload
} = require('../services/eventNormalization.service');

// Team-visible events can be seen by everyone, but only their owner (or a super admin) may change them.
function canModifyEvent(event, user) {
  if (!user) return false;
  return Boolean(user.isSuperAdmin) || String(event.ownerUserId || '') === String(user.id || '');
}

// Events share the lead_events table with lead notes, calls and follow-ups, and can hang off a
// lead, client or project. /events needs no module permission, so it only ever writes plain
// "event" rows, owned by the caller, on records the caller can read.
const SCOPE_PERMISSION = { lead: 'leads.read', client: 'clients.read', project: 'projects.read' };

async function canUseScope(event, user, leadCache = new Map()) {
  const scopeType = String(event.scopeType || 'global').toLowerCase();
  if (scopeType === 'global' || user?.isSuperAdmin) return true;
  const permission = SCOPE_PERMISSION[scopeType];
  if (!permission || !hasPermission(user, permission)) return false;
  if (scopeType !== 'lead') return true;
  const leadId = String(event.leadId || event.scopeId || '');
  if (!leadCache.has(leadId)) leadCache.set(leadId, leadId ? await leadModel.findById(leadId) : null);
  const lead = leadCache.get(leadId);
  return Boolean(lead && canAccessLead(user, lead));
}

function forbiddenScope(res) {
  return res.status(403).json({ success: false, message: 'You do not have access to the record this event is linked to' });
}

function forbiddenEvent(res) {
  return res.status(403).json({ success: false, message: 'Only the event owner can change this event' });
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

    rows = rows.filter((event) => isEventRecord(event) && isVisibleToUser(event, req.user));
    const leadCache = new Map();
    const allowed = [];
    for (const event of rows) {
      if (await canUseScope(event, req.user, leadCache)) allowed.push(event);
    }
    res.json({ success: true, data: allowed });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const record = await leadEventModel.findById(req.params.id);
    if (!record || !isEventRecord(record) || !isVisibleToUser(record, req.user) || !(await canUseScope(record, req.user))) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const rawBody = req.body || {};
    const body = {
      ...normalizeEventPayload(rawBody, req, { defaultScopeType: 'global', defaultEventType: 'event' }),
      ownerUserId: String(req.user.id),
      eventType: 'event'
    };
    const attachmentEntityId = String(rawBody.attachmentEntityId || rawBody.uploadEntityId || '').trim();
    if (!body.title) {
      return res.status(400).json({ success: false, message: 'Event title is required' });
    }
    if (body.scopeType !== 'global' && !String(body.scopeId || '').trim()) {
      return res.status(400).json({ success: false, message: 'Linked record is required for this event scope' });
    }
    if (!(await canUseScope(body, req.user))) return forbiddenScope(res);
    // Uploads made before the event existed sit under a temporary id; an existing record's id
    // would pull that record's files into this event.
    const rebindable = attachmentEntityId && !(await leadEventModel.findById(attachmentEntityId));
    const record = await leadEventModel.create(body);
    if (rebindable && attachmentEntityId !== record.id) {
      await rebindFileAssetsToEntity({ moduleName: 'events' }, attachmentEntityId, record.id);
    }
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const current = await leadEventModel.findById(req.params.id);
    if (!current || !isEventRecord(current) || !isVisibleToUser(current, req.user)) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    if (!canModifyEvent(current, req.user)) return forbiddenEvent(res);
    const body = {
      ...normalizeEventPayload({ ...current, ...(req.body || {}) }, req, { defaultScopeType: 'global', defaultEventType: 'event' }),
      ownerUserId: current.ownerUserId || String(req.user.id),
      eventType: 'event'
    };
    if (!body.title) {
      return res.status(400).json({ success: false, message: 'Event title is required' });
    }
    if (body.scopeType !== 'global' && !String(body.scopeId || '').trim()) {
      return res.status(400).json({ success: false, message: 'Linked record is required for this event scope' });
    }
    if (!(await canUseScope(body, req.user))) return forbiddenScope(res);
    const record = await leadEventModel.update(req.params.id, body);
    await cleanupRemovedAttachments(current.attachments, record.attachments, getEventAttachmentContext(record));
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const current = await leadEventModel.findById(req.params.id);
    if (!current || !isEventRecord(current) || !isVisibleToUser(current, req.user)) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    if (!canModifyEvent(current, req.user)) return forbiddenEvent(res);
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
  remove,
  requirePermission
};
