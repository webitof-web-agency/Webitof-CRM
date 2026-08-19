const express = require('express');
const controller = require('../controllers/followUps.controller');
const { requirePermission } = require('../middlewares/auth');

function buildRouter(handlers, managePermission) {
  const router = express.Router();
  router.get('/', requirePermission('followups.view_own', 'followups.view_team', 'followups.view_all'), handlers.list);
  router.post('/', requirePermission(managePermission), handlers.create);
  router.patch('/:id', requirePermission(managePermission), handlers.update);
  return router;
}

module.exports = {
  templates: buildRouter(controller.templates, 'followups.manage_templates'),
  sequences: buildRouter(controller.sequences, 'followups.manage_sequences'),
  automationRules: buildRouter(controller.automationRules, 'followups.manage_automation'),
  escalationRules: buildRouter(controller.escalationRules, 'followups.manage_escalations')
};
