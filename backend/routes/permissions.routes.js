const express = require('express');
const controller = require('../controllers/permissions.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('permissions.manage', 'roles.manage'), controller.listController);

module.exports = router;
