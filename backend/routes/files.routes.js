const express = require('express');
const controller = require('../controllers/files.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('files.read'), controller.list);
router.get('/:id', requirePermission('files.read'), controller.getById);
router.post('/upload', requirePermission('files.write'), controller.upload.any(), controller.uploadFiles);
router.get('/drive/browse', requirePermission('files.read'), controller.browseDrive);
router.get('/drive/usage', requirePermission('files.read'), controller.getUsage);
router.post('/drive/folder', requirePermission('files.write'), controller.createDriveFolderController);
router.get('/drive/:driveFileId/view', controller.viewDriveFile);
router.put('/drive/:driveFileId/rename', requirePermission('files.write'), controller.renameDriveFile);
router.delete('/drive/:driveFileId', requirePermission('files.write'), controller.deleteDriveFile);
router.patch('/:id/archive', requirePermission('files.write'), controller.archive);

module.exports = router;
