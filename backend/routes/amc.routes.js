const express = require('express');
const controller = require('../controllers/amc.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('amc.read'), controller.list);
router.post('/', requirePermission('amc.write'), controller.create);
router.get('/:id', requirePermission('amc.read'), controller.getById);
router.put('/:id', requirePermission('amc.write'), controller.update);
router.delete('/:id', requirePermission('amc.delete'), controller.remove);

module.exports = router;
