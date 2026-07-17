const express = require('express');
const controller = require('../controllers/payments.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('payments.read'), controller.list);
router.post('/', requirePermission('payments.write'), controller.create);
router.get('/:id', requirePermission('payments.read'), controller.getById);
router.put('/:id', requirePermission('payments.write'), controller.update);
router.delete('/:id', requirePermission('payments.delete'), controller.remove);

module.exports = router;
