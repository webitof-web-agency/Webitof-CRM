const express = require('express');
const controller = require('../controllers/callLogs.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

// Recording playback/download routes are mounted (signature-checked) in routes/index.js.

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
