const express = require('express');
const controller = require('../controllers/settings.controller');
const storageController = require('../controllers/storageSettings.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/public', controller.fetchPublicSettings);
router.get('/storage', requirePermission('settings.read'), storageController.get);
router.put('/storage', requirePermission('settings.write'), storageController.update);
router.post('/storage/test', requirePermission('settings.write'), storageController.test);
router.get('/', requirePermission('settings.read'), controller.fetchSettings);
router.put('/', requirePermission('settings.write'), controller.saveSettings);

module.exports = router;
