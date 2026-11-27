const notificationModel = require('../models/notification.model');
const {
  getUnreadCount,
  listNotifications,
  listUnreadSummary,
  notificationStats,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationsRead
} = require('../services/notification.service');

async function listController(req, res, next) {
  try {
    const limit = Math.max(1, Number(req.query?.limit || 50));
    const offset = Math.max(0, Number(req.query?.offset || 0));
    const unreadOnly = String(req.query?.unreadOnly || '').toLowerCase() === 'true';
    const filter = String(req.query?.filter || 'all');
    const notifications = await listNotifications(req.user?.id, { limit, offset, unreadOnly, filter });
    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
}

async function unreadCountController(req, res, next) {
  try {
    const unreadCount = await getUnreadCount(req.user?.id);
    res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    next(error);
  }
}

async function unreadSummaryController(req, res, next) {
  try {
    res.json({ success: true, data: await listUnreadSummary(req.user?.id) });
  } catch (error) {
    next(error);
  }
}

async function statsController(req, res, next) {
  try {
    res.json({ success: true, data: await notificationStats(req.user?.id) });
  } catch (error) {
    next(error);
  }
}

async function markManyReadController(req, res, next) {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'ids must be a list' });
    }
    res.json({ success: true, data: await markNotificationsRead(req.user?.id, ids) });
  } catch (error) {
    next(error);
  }
}

async function markReadController(req, res, next) {
  try {
    const notification = await markNotificationRead(req.user?.id, req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
}

async function markAllReadController(req, res, next) {
  try {
    const result = await markAllNotificationsRead(req.user?.id);
    res.json({ success: true, data: result, message: 'Marked all notifications as read' });
  } catch (error) {
    next(error);
  }
}

async function seedController(req, res, next) {
  try {
    const row = await notificationModel.create({
      recipientType: 'user',
      userId: req.user?.id || null,
      moduleName: 'system',
      eventKey: 'seed',
      entityType: 'system',
      entityId: 'seed',
      title: 'Notification system ready',
      message: 'Your notification center is connected.',
      severity: 'info',
      channels: ['inApp'],
      isRead: false,
      payload: {
        routePath: '/app/notifications'
      }
    });
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listController,
  markAllReadController,
  markManyReadController,
  markReadController,
  seedController,
  statsController,
  unreadCountController,
  unreadSummaryController
};
