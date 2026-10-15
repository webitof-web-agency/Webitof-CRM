const express = require('express');
const controller = require('../controllers/callLogs.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

// Audio playback & download (audio streaming should be directly accessible by audio element)
router.get('/recordings/:filename', controller.streamRecording);
router.get('/recordings/:filename/download', controller.downloadRecording);

// Stats
router.get('/stats', requirePermission('calls.read'), controller.stats);

// Call logs CRUD
router.get('/', requirePermission('calls.read'), controller.list);
router.get('/:id', requirePermission('calls.read'), controller.getById);
router.post('/', requirePermission('calls.write'), controller.create);
router.post('/upload-recording', requirePermission('calls.write'), controller.uploadMiddleware, controller.uploadRecording);
router.patch('/:id', requirePermission('calls.write'), controller.update);
router.delete('/:id', requirePermission('calls.delete'), controller.remove);

module.exports = router;
