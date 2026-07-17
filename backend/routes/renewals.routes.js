const express = require('express');
const controller = require('../controllers/renewals.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('renewals.read'), controller.list);
router.post('/', requirePermission('renewals.write'), controller.create);
router.get('/:id', requirePermission('renewals.read'), controller.getById);
router.put('/:id', requirePermission('renewals.write'), controller.update);
router.delete('/:id', requirePermission('renewals.delete'), controller.remove);

module.exports = router;
