const { createCrudController } = require('./crudController');
const projectModel = require('../models/project.model');
const { buildProjectSummary } = require('../services/analytics.service');
const { cleanupRemovedAttachments } = require('../services/attachmentCleanup.service');
const { notifyBusinessEvent } = require('../services/notification.service');

const projectsController = createCrudController(projectModel, {
  defaultOrder: 'updated_at DESC'
});

projectsController.create = async (req, res, next) => {
  try {
    const record = await projectModel.create(req.body || {});
    notifyBusinessEvent({
      moduleName: 'projects',
      eventKey: 'created',
      entity: record,
      clientId: record.clientId || null,
      title: 'Project created',
      message: `${record.title || 'Project'} was created.`,
      actorUserId: req.user?.id || null,
      notifyClient: Boolean(record.clientId),
      routePath: `/app/projects/${record.id}`
    }).catch(() => {});
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

projectsController.update = async (req, res, next) => {
  try {
    const current = await projectModel.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    const record = await projectModel.update(req.params.id, req.body || {});
    await cleanupRemovedAttachments(current.activities || [], record.activities || [], {
      moduleName: 'projects',
      entityId: req.params.id
    });

    notifyBusinessEvent({
      moduleName: 'projects',
      eventKey: 'updated',
      entity: record,
      clientId: record.clientId || null,
      title: 'Project updated',
      message: `${record.title || 'Project'} was updated.`,
      actorUserId: req.user?.id || null,
      notifyClient: Boolean(record.clientId),
      routePath: `/app/projects/${record.id}`
    }).catch(() => {});

    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

projectsController.remove = async (req, res, next) => {
  try {
    const current = await projectModel.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    const ok = await projectModel.remove(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    await cleanupRemovedAttachments(current.activities || [], [], {
      moduleName: 'projects',
      entityId: req.params.id
    });

    notifyBusinessEvent({
      moduleName: 'projects',
      eventKey: 'deleted',
      entity: current,
      clientId: current.clientId || null,
      title: 'Project deleted',
      message: `${current.title || 'Project'} was deleted.`,
      severity: 'warning',
      actorUserId: req.user?.id || null,
      notifyClient: Boolean(current.clientId)
    }).catch(() => {});

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
};

projectsController.summary = async (req, res, next) => {
  try {
    const result = await buildProjectSummary(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = projectsController;
