const leadEventModel = require('../models/leadEvent.model');
const { hasPermission, requirePermission } = require('../middlewares/auth');
const { cleanupRemovedAttachments, rebindFileAssetsToEntity } = require('../services/attachmentCleanup.service');
const {
  getEventAttachmentContext,
  isEventRecord,
  isVisibleToUser,
  normalizeEventPayload
} = require('../services/eventNormalization.service');

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
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const record = await leadEventModel.findById(req.params.id);
    if (!record || !isEventRecord(record) || !isVisibleToUser(record, req.user)) {
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
    const body = normalizeEventPayload(rawBody, req, { defaultScopeType: 'global', defaultEventType: 'event' });
    const attachmentEntityId = String(rawBody.attachmentEntityId || rawBody.uploadEntityId || '').trim();
    if (body.scopeType !== 'global' && !String(body.scopeId || '').trim()) {
      return res.status(400).json({ success: false, message: 'Linked record is required for this event scope' });
    }
    const record = await leadEventModel.create(body);
    if (attachmentEntityId && attachmentEntityId !== record.id) {
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
    const body = normalizeEventPayload({ ...current, ...(req.body || {}) }, req, { defaultScopeType: 'global', defaultEventType: 'event' });
    if (body.scopeType !== 'global' && !String(body.scopeId || '').trim()) {
      return res.status(400).json({ success: false, message: 'Linked record is required for this event scope' });
    }
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
