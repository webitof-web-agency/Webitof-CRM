const express = require('express');
const controller = require('../controllers/googleDrive.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/status', requirePermission('settings.read'), controller.status);
router.get('/config', requirePermission('settings.read'), controller.getConfig);
router.put('/config', requirePermission('settings.write'), controller.saveConfig);
router.post('/connect', requirePermission('settings.write'), controller.connect);
router.post('/disconnect', requirePermission('settings.write'), controller.disconnect);
router.get('/backups', requirePermission('settings.read'), controller.listBackups);
router.post('/backups/run', requirePermission('settings.write'), controller.runBackupNow);
// A backup holds the whole database, so downloading needs write permission.
router.get('/backups/:fileId/download', requirePermission('settings.write'), controller.downloadBackup);

module.exports = router;
