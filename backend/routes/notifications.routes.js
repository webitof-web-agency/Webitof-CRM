const express = require('express');
const controller = require('../controllers/notifications.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const preferences = require('../services/notify/preferences.service');
const push = require('../services/notify/push.service');
const { channelStatus } = require('../services/notify/dispatcher.service');

const router = express.Router();

router.get('/', controller.listController);
router.get('/unread-count', controller.unreadCountController);
router.get('/unread-summary', controller.unreadSummaryController);
router.get('/stats', controller.statsController);
router.patch('/read-all', controller.markAllReadController);
router.patch('/read-many', controller.markManyReadController);

// The signed-in user's own channel choices (push / email / WhatsApp per kind of notification).
router.get('/preferences', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      ...(await preferences.getPreferences(req.user.id)),
      categories: preferences.CATEGORIES,
      channelStatus: channelStatus()
    }
  });
}));
router.put('/preferences', asyncHandler(async (req, res) => {
  const saved = await preferences.savePreferences(req.user.id, req.body || {});
  res.json({ success: true, data: { ...saved, categories: preferences.CATEGORIES, channelStatus: channelStatus() } });
}));

// Phone apps register their Firebase token here after sign-in (CRM app: app = 'crm').
router.post('/devices', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await push.registerDevice(req.user.id, req.body || {}) });
}));
router.delete('/devices', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await push.removeDevice(req.user.id, req.body?.token || req.query?.token) });
}));

router.patch('/:id/read', controller.markReadController);

module.exports = router;
