const express = require('express');
const controller = require('../controllers/files.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('files.read'), controller.list);
router.get('/browse', requirePermission('files.read'), controller.browse);
router.get('/usage', requirePermission('files.read'), controller.getUsage);
router.post('/upload', requirePermission('files.write'), controller.upload.any(), controller.uploadFiles);
// /drive/:id paths are kept for older clients; :id accepts a file id or an older Drive id.
router.get('/drive/usage', requirePermission('files.read'), controller.getUsage);
router.put('/drive/:id/rename', requirePermission('files.write'), controller.rename);
router.delete('/drive/:id', requirePermission('files.write'), controller.remove);
router.get('/:id', requirePermission('files.read'), controller.getById);
router.put('/:id/rename', requirePermission('files.write'), controller.rename);
router.patch('/:id/archive', requirePermission('files.write'), controller.archive);
router.delete('/:id', requirePermission('files.write'), controller.remove);

module.exports = router;
