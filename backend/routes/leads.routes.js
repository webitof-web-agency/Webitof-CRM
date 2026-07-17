const express = require('express');
const controller = require('../controllers/leads.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('leads.read'), controller.list);
router.post('/', requirePermission('leads.write'), controller.create);
router.get('/:id/summary', requirePermission('leads.read'), controller.summary);
router.get('/:id', requirePermission('leads.read'), controller.getById);
router.put('/:id', requirePermission('leads.write'), controller.update);
router.post('/:id/convert', requirePermission('leads.write'), controller.convert);
router.delete('/:id', requirePermission('leads.delete'), controller.remove);

module.exports = router;
