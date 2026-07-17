const express = require('express');
const controller = require('../controllers/masters.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('masters.read'), controller.listMasters);
router.get('/:type', requirePermission('masters.read'), controller.listMasters);
router.post('/:type', requirePermission('masters.write'), controller.createMaster);
router.put('/:type/:id', requirePermission('masters.write'), controller.updateMaster);
router.delete('/:type/:id', requirePermission('masters.delete'), controller.deleteMaster);

module.exports = router;
