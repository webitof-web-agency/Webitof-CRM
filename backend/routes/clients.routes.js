const express = require('express');
const controller = require('../controllers/clients.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('clients.read'), controller.list);
router.post('/', requirePermission('clients.write'), controller.create);
router.get('/:id/summary', requirePermission('clients.read'), controller.summary);
router.get('/:id', requirePermission('clients.read'), controller.getById);
router.put('/:id', requirePermission('clients.write'), controller.update);
router.delete('/:id', requirePermission('clients.delete'), controller.remove);

module.exports = router;
