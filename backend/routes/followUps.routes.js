const express = require('express');
const controller = require('../controllers/followUps.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();
const canView = requirePermission('followups.view_own', 'followups.view_team', 'followups.view_all');

router.get('/options', canView, controller.options);
router.get('/today', canView, controller.today);
router.get('/overdue', canView, (req, res, next) => controller.list({ ...req, query: { ...(req.query || {}), overdue: 'true' } }, res, next));
router.get('/attention-required', canView, controller.attentionRequired);
router.get('/calendar', canView, controller.list);
router.get('/analytics', requirePermission('followups.analytics', 'followups.view_all'), controller.analytics);
router.get('/related-search', canView, controller.searchRelated);
router.get('/export', requirePermission('followups.export'), controller.exportCsv);
router.post('/bulk', requirePermission('followups.bulk_assign', 'followups.edit_any'), controller.bulk);
router.post('/automation/run', requirePermission('followups.manage_automation'), controller.runAutomation);
router.get('/settings', requirePermission('followups.manage_settings', 'settings.read'), controller.getSettings);
router.put('/settings', requirePermission('followups.manage_settings', 'settings.write'), controller.updateSettings);
router.get('/payment-promises', requirePermission('payments.read'), controller.listPaymentPromises);
router.post('/payment-promises', requirePermission('payments.write'), controller.createPaymentPromise);

router.get('/', canView, controller.list);
router.post('/', requirePermission('followups.create'), controller.create);
router.get('/:id', canView, controller.getById);
router.patch('/:id', requirePermission('followups.edit_own', 'followups.edit_any'), controller.update);
router.delete('/:id', requirePermission('followups.delete'), controller.remove);
router.post('/:id/restore', requirePermission('followups.restore'), controller.restore);
router.post('/:id/start', requirePermission('followups.complete'), controller.start);
router.post('/:id/complete', requirePermission('followups.complete'), controller.complete);
router.post('/:id/reschedule', requirePermission('followups.reschedule'), controller.reschedule);
router.post('/:id/snooze', requirePermission('followups.reschedule'), controller.snooze);
router.post('/:id/reassign', requirePermission('followups.reassign'), controller.reassign);
router.post('/:id/escalate', requirePermission('followups.escalate'), controller.escalate);
router.post('/:id/acknowledge', requirePermission('followups.edit_own', 'followups.edit_any'), controller.acknowledge);

module.exports = router;
