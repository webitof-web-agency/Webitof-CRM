const express = require('express');
const controller = require('../controllers/leads.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('leads.read'), controller.list);
router.post('/', requirePermission('leads.write'), controller.create);
router.get('/options', requirePermission('leads.read'), controller.options);
router.get('/duplicates', requirePermission('leads.read'), controller.duplicates);
router.post('/bulk', requirePermission('leads.write', 'leads.assign', 'leads.manage_followup'), controller.bulk);
router.get('/:id/summary', requirePermission('leads.read'), controller.summary);
router.get('/:id/history', requirePermission('leads.read'), controller.history);
router.get('/:id/conversion-preview', requirePermission('leads.convert', 'leads.write'), controller.conversionPreview);
router.post('/:id/follow-ups', requirePermission('leads.manage_followup', 'leads.write'), controller.addFollowUp);
router.patch('/:id/follow-ups/:eventId', requirePermission('leads.manage_followup', 'leads.write'), controller.updateFollowUp);
router.post('/:id/activities', requirePermission('leads.write'), controller.addActivity);
router.post('/:id/notes', requirePermission('leads.write'), controller.addNote);
router.post('/:id/calls', requirePermission('leads.write'), controller.logCall);
router.patch('/:id/status', requirePermission('leads.write'), controller.changeStatus);
router.patch('/:id/assign', requirePermission('leads.assign', 'leads.write'), controller.assign);
router.post('/:id/won', requirePermission('leads.write'), controller.markWon);
router.post('/:id/lost', requirePermission('leads.write'), controller.markLost);
router.post('/:id/reopen', requirePermission('leads.write'), controller.reopen);
router.get('/:id', requirePermission('leads.read'), controller.getById);
router.put('/:id', requirePermission('leads.write'), controller.update);
router.post('/:id/convert', requirePermission('leads.convert', 'leads.write'), controller.convert);
router.delete('/:id', requirePermission('leads.delete'), controller.remove);

module.exports = router;
