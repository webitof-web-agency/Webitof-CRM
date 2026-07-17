const { createCrudController } = require('./crudController');
const projectModel = require('../models/project.model');
const { buildProjectSummary } = require('../services/analytics.service');
const { cleanupRemovedAttachments } = require('../services/attachmentCleanup.service');

const projectsController = createCrudController(projectModel, {
  defaultOrder: 'updated_at DESC'
});

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
