const express = require('express');
const controller = require('../controllers/leadCommissions.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('lead-commissions.read'), controller.list);
router.post('/', requirePermission('lead-commissions.write'), controller.create);
router.get('/:id', requirePermission('lead-commissions.read'), controller.getById);
router.put('/:id', requirePermission('lead-commissions.write'), controller.update);
router.delete('/:id', requirePermission('lead-commissions.delete'), controller.remove);

module.exports = router;
