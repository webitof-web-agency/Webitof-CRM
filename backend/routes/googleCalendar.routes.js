const express = require('express');
const controller = require('../controllers/googleCalendar.controller');

// Each user connects and manages their own calendar; no permission beyond being signed in.
const router = express.Router();

router.get('/status', controller.status);
router.post('/connect', controller.connect);
router.put('/sync-mode', controller.setMode);
router.post('/sync', controller.syncNow);
router.post('/disconnect', controller.disconnect);

module.exports = router;
