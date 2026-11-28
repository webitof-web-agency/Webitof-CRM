// Sends an in-app notification out on the user's other channels: phone push (CRM / HRM app),
// email and WhatsApp, by the user's notification settings (preferences.service). Every attempt is
// logged in notification_deliveries. Runs after the request, so a slow mail server never blocks it.
const { query } = require('../../config/db');
const { createId } = require('../../utils/format');
const preferences = require('./preferences.service');
const push = require('./push.service');
const whatsapp = require('./whatsapp.service');

// HRM sends its own pushes; settings alerts (Drive, backups) send their own emails.
const SKIP_MODULES = new Set(['hrm', 'settings']);

async function logDelivery({ notificationId = null, userId = null, recipient = '', channel, status, error = null, payload = {} }) {
  await query(
    `insert into notification_deliveries (id, notification_id, user_id, recipient, channel, status, error, payload)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [createId('ndel'), notificationId, userId, String(recipient || '').slice(0, 200), channel, status, error ? String(error).slice(0, 500) : null, JSON.stringify(payload)]
  ).catch((err) => console.error('[Notify] Delivery log failed:', err.message));
}

function detailsOf(notification) {
  const details = notification?.payload?.details;
  return Array.isArray(details) ? details.filter((row) => row && row.label && row.value) : [];
}

function pushBody(notification) {
  const details = detailsOf(notification).slice(0, 3).map((row) => `${row.label}: ${row.value}`);
  return [notification.message, ...details].filter(Boolean).join('\n');
}

async function dispatch(notification, user) {
  if (!notification || !user?.id) return { skipped: true };
  if (SKIP_MODULES.has(String(notification.moduleName || ''))) return { skipped: true };
  // Nobody is pushed or mailed about their own action.
  if (notification.actorUserId && String(notification.actorUserId) === String(user.id)) return { skipped: true };

  const prefs = await preferences.getPreferences(user.id);
  const category = preferences.categoryOf(notification.moduleName, notification.eventKey);
  const wanted = prefs.channels[category] || {};
  const { sendNotificationEmail, toAbsoluteUrl } = require('../notification.service');
  const route = notification.routePath || notification.payload?.routePath || '';
  const link = toAbsoluteUrl(route);
  const details = detailsOf(notification);
  const results = {};

  if (wanted.push && push.isConfigured()) {
    try {
      const sent = await push.pushToUser(user.id, {
        title: notification.title,
        body: pushBody(notification),
        tag: notification.entityId ? `${notification.moduleName}:${notification.entityId}` : undefined,
        data: { type: notification.moduleName, eventKey: notification.eventKey, route, notificationId: notification.id, entityId: notification.entityId || '' }
      });
      const ok = sent.some((item) => item.sent);
      results.push = ok;
      if (sent.length) {
        await logDelivery({ notificationId: notification.id, userId: user.id, recipient: `${sent.length} device(s)`, channel: 'push', status: ok ? 'sent' : 'failed', error: ok ? null : sent.map((item) => item.reason).join('; ') });
      }
    } catch (error) {
      await logDelivery({ notificationId: notification.id, userId: user.id, channel: 'push', status: 'failed', error: error.message });
    }
  }

  if (wanted.email && user.email) {
    const result = await sendNotificationEmail({
      to: user.email,
      subject: notification.title,
      title: notification.title,
      message: notification.message,
      routePath: route,
      severity: notification.severity || 'info',
      details
    });
    results.email = result.sent;
    await logDelivery({ notificationId: notification.id, userId: user.id, recipient: user.email, channel: 'email', status: result.sent ? 'sent' : 'failed', error: result.reason });
    await query(
      `update notifications set email_to = $2, email_status = $3, email_sent_at = case when $3 = 'sent' then now() else email_sent_at end, email_error = $4, updated_at = now() where id = $1`,
      [notification.id, user.email, result.sent ? 'sent' : 'failed', result.sent ? '' : String(result.reason || '').slice(0, 300)]
    ).catch(() => {});
  }

  if (wanted.whatsapp && whatsapp.isConfigured() && prefs.effectiveWhatsappNumber) {
    try {
      const result = await whatsapp.sendTemplate({
        to: prefs.effectiveWhatsappNumber,
        params: whatsapp.notificationParams({ name: user.fullName, title: notification.title, message: notification.message, details, link })
      });
      results.whatsapp = result.sent;
      await logDelivery({ notificationId: notification.id, userId: user.id, recipient: prefs.effectiveWhatsappNumber, channel: 'whatsapp', status: result.sent ? 'sent' : 'failed', error: result.reason, payload: { messageId: result.messageId || '' } });
    } catch (error) {
      await logDelivery({ notificationId: notification.id, userId: user.id, recipient: prefs.effectiveWhatsappNumber, channel: 'whatsapp', status: 'failed', error: error.message });
    }
  }
  return results;
}

function dispatchLater(notification, user) {
  setImmediate(() => {
    dispatch(notification, user).catch((error) => console.error('[Notify] Dispatch failed:', error.message));
  });
}

// For notifications written straight into the table (follow-up reminders inside the automation cycle).
async function dispatchByIds(ids = []) {
  const list = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!list.length) return;
  const notificationModel = require('../../models/notification.model');
  const { listUsers } = require('../auth.service');
  const users = new Map((await listUsers()).map((user) => [String(user.id), user]));
  for (const id of list) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const notification = await notificationModel.findById(id);
      const user = notification?.userId ? users.get(String(notification.userId)) : null;
      // eslint-disable-next-line no-await-in-loop
      if (notification && user?.isActive !== false) await dispatch(notification, user);
    } catch (error) {
      console.error(`[Notify] Dispatch of ${id} failed:`, error.message);
    }
  }
}

function channelStatus() {
  const { getMailboxStatus } = require('../mailer.service');
  let email = { configured: false };
  try {
    const mailboxes = getMailboxStatus();
    email = { configured: Boolean(mailboxes?.defaultAccount?.configured || (mailboxes?.mailboxes || []).some((box) => box?.source && box.source !== 'none')) };
  } catch {
    email = { configured: false };
  }
  return {
    inApp: { configured: true },
    email,
    push: push.status(),
    whatsapp: whatsapp.status()
  };
}

module.exports = { channelStatus, dispatch, dispatchByIds, dispatchLater, logDelivery };
