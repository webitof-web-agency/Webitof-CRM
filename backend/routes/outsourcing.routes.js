const express = require('express');
const controller = require('../controllers/outsourcing.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('outsourcing.read'), controller.list);
router.post('/', requirePermission('outsourcing.write'), controller.create);
router.post('/automation/run', requirePermission('outsourcing.write'), controller.runAutomation);
router.get('/automation/logs', requirePermission('outsourcing.read'), controller.getAutomationLogs);
router.get('/automation/summary', requirePermission('outsourcing.read'), controller.getAutomationSummary);
router.get('/:id/automation-history', requirePermission('outsourcing.read'), controller.getAutomationHistory);
router.get('/:id', requirePermission('outsourcing.read'), controller.getById);
router.put('/:id', requirePermission('outsourcing.write'), controller.update);
router.delete('/:id', requirePermission('outsourcing.delete'), controller.remove);

module.exports = router;
