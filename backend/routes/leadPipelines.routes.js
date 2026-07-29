const express = require('express');
const controller = require('../controllers/leadPipelines.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('leads.read', 'users.manage'), controller.list);
router.get('/options', requirePermission('leads.read', 'users.manage'), controller.options);
router.post('/', requirePermission('users.manage'), controller.create);
router.put('/:id', requirePermission('users.manage'), controller.update);
router.delete('/:id', requirePermission('users.manage'), controller.remove);

module.exports = router;
