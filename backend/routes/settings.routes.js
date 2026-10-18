const express = require('express');
const controller = require('../controllers/settings.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('settings.read'), controller.fetchSettings);
router.put('/', requirePermission('settings.write'), controller.saveSettings);

module.exports = router;
