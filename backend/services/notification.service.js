const { listUsers } = require('./auth.service');
const { getSettings } = require('../models/settings.model');
const clientModel = require('../models/client.model');
const notificationModel = require('../models/notification.model');
const { sendMail } = require('./mailer.service');
const { emitToUser, emitToUsers } = require('./socketHub.service');
const { createId, nowIso } = require('../utils/format');

const DEFAULT_INTERNAL_ROLES_BY_MODULE = {
  clients: ['admin', 'accountant', 'sales'],
  projects: ['admin', 'accountant', 'sales'],
  invoices: ['admin', 'accountant', 'sales'],
  payments: ['admin', 'accountant'],
  expenses: ['admin', 'accountant'],
  outsourcing: ['admin', 'accountant'],
  'lead-commissions': ['admin', 'accountant', 'sales'],
  leads: ['admin', 'sales'],
  'lead-events': ['admin', 'sales'],
  amc: ['admin', 'accountant', 'sales'],
  renewals: ['admin', 'accountant', 'sales'],
  banking: ['admin', 'accountant'],
  reports: ['admin', 'accountant'],
  files: ['admin'],
  settings: ['admin']
};

const DEFAULT_ROUTE_BY_MODULE = {
  clients: (entity) => `/app/clients/${entity?.id || ''}`,
  projects: (entity) => `/app/projects/${entity?.id || ''}`,
  invoices: (entity) => `/app/invoices/${entity?.id || ''}`,
  payments: (entity) => `/app/payments/${entity?.id || ''}`,
  expenses: (entity) => `/app/expenses/${entity?.id || ''}`,
  outsourcing: (entity) => `/app/outsourcing/${entity?.id || ''}`,
  'lead-commissions': (entity) => `/app/lead-commissions/${entity?.id || ''}`,
  leads: (entity) => `/app/leads/${entity?.id || ''}`,
  amc: (entity) => `/app/amc/${entity?.id || ''}`,
  renewals: (entity) => `/app/renewals/${entity?.id || ''}`
};

function toArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function roleAllowsNotification(role = {}, moduleName = '', eventKey = '') {
  const code = normalizeText(role.code).toLowerCase();
  const settings = role?.payload?.notificationSettings || {};

  if (settings.enabled === false) return false;
  if (settings.modules?.length && !settings.modules.includes('*') && !settings.modules.includes(moduleName)) {
    return false;
  }
  if (settings.events?.length && !settings.events.includes('*') && !settings.events.includes(eventKey)) {
    return false;
  }

  if (code === 'admin') return true;
  const defaults = DEFAULT_INTERNAL_ROLES_BY_MODULE[moduleName] || ['admin'];
  return defaults.includes(code);
}

function roleChannels(role = {}) {
  const settings = role?.payload?.notificationSettings || {};
  const channels = [];
  if (settings.inApp !== false) channels.push('inApp');
  if (settings.email) channels.push('email');
  if (!channels.length) channels.push('inApp');
  return [...new Set(channels)];
}

function buildRoutePath(moduleName, entity = {}, routePath = '') {
  if (routePath) return routePath;
  const resolver = DEFAULT_ROUTE_BY_MODULE[moduleName];
  if (typeof resolver === 'function') return resolver(entity);
  return '';
}

function resolvePublicBaseUrl() {
  const candidates = [
    process.env.FRONTEND_URL,
    process.env.APP_PUBLIC_URL,
    process.env.PUBLIC_APP_URL,
    process.env.CLIENT_APP_URL,
    process.env.WEB_APP_URL
  ];
  return candidates.map((value) => normalizeText(value, '')).find(Boolean) || '';
}

function toAbsoluteUrl(routePath = '') {
  const normalizedRoute = normalizeText(routePath, '');
  if (!normalizedRoute) return '';
  if (/^https?:\/\//i.test(normalizedRoute)) return normalizedRoute;
  const base = resolvePublicBaseUrl();
  if (!base) return normalizedRoute;
  return `${base.replace(/\/$/, '')}${normalizedRoute.startsWith('/') ? normalizedRoute : `/${normalizedRoute}`}`;
}

function buildEmailSubject(title, moduleName, eventKey) {
  return normalizeText(title) || `${moduleName} ${eventKey}`.replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildEmailHtml({ title, message, routePath, companyName, severity = 'info' }) {
  const accentMap = {
    success: '#16a34a',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#2563eb'
  };
  const accent = accentMap[severity] || accentMap.info;
  const safeTitle = normalizeText(title, 'Notification');
  const safeMessage = normalizeText(message, '');
  const safeCompany = normalizeText(companyName, 'Webitof CRM');
  const link = routePath ? `<a href="${routePath}" style="display:inline-block;margin-top:16px;padding:12px 18px;border-radius:12px;background:${accent};color:#fff;text-decoration:none;font-weight:600">Open CRM</a>` : '';
  const routeBlock = routePath ? `
    <div style="margin-top:18px;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;background:#f8fafc;color:#475569;font-size:12px;word-break:break-all">
      ${routePath}
    </div>
  ` : '';

  return `
    <div style="font-family:Arial,sans-serif;background:linear-gradient(180deg,#f8fafc 0%,#eef2ff 100%);padding:24px">
      <div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:22px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.08)">
        <div style="background:${accent};padding:18px 24px;color:#fff">
          <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;opacity:0.9">${safeCompany}</div>
          <div style="margin-top:6px;font-size:22px;font-weight:700;line-height:1.3">${safeTitle}</div>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155">${safeMessage}</p>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            ${link}
            <span style="font-size:12px;color:#64748b">You can open this directly from CRM as well.</span>
          </div>
          ${routeBlock}
        </div>
        <div style="padding:14px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.6">
          This notification was generated automatically by Webitof CRM.
        </div>
      </div>
    </div>
  `;
}

async function sendNotificationEmail({ to, subject, title, message, routePath, severity = 'info' }) {
  if (!to) {
    return { sent: false, reason: 'Recipient email missing' };
  }

  const settings = await getSettings();
  const companyName = settings?.company?.name || 'Webitof CRM';
  const linkUrl = toAbsoluteUrl(routePath);
  const resolvedSubject = normalizeText(subject, buildEmailSubject(title, 'Notification', ''));
  const html = buildEmailHtml({ title, message, routePath: linkUrl, companyName, severity });
  const text = `${normalizeText(title, 'Notification')}\n\n${normalizeText(message, '')}${linkUrl ? `\n\nOpen: ${linkUrl}` : ''}`;

  try {
    await sendMail({ to, subject: resolvedSubject, text, html });
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error.message || 'Email send failed' };
  }
}

async function listNotifications(userId, { limit = 50, offset = 0, unreadOnly = false } = {}) {
  const clauses = ['user_id = $1'];
  const values = [String(userId || '')];
  if (unreadOnly) {
    clauses.push(`coalesce(is_read, false) = false`);
  }

  values.push(Math.max(1, Number(limit) || 50));
  const limitIndex = values.length;
  values.push(Math.max(0, Number(offset) || 0));
  const offsetIndex = values.length;

  const result = await notificationModel.list({
    where: { userId: String(userId || '') },
    orderBy: 'created_at DESC'
  });

  const rows = result.slice(Number(offset) || 0, (Number(offset) || 0) + (Number(limit) || 50));
  return unreadOnly ? rows.filter((row) => !row.isRead) : rows;
}

async function getUnreadCount(userId) {
  const result = await notificationModel.list({
    where: { userId: String(userId || '') },
    orderBy: 'created_at DESC'
  });
  return result.filter((row) => !row.isRead).length;
}

async function markNotificationRead(userId, notificationId) {
  const notification = await notificationModel.findById(notificationId);
  if (!notification || String(notification.userId || '') !== String(userId || '')) {
    return null;
  }

  if (!notification.isRead) {
    const updated = await notificationModel.update(notificationId, {
      isRead: true,
      readAt: nowIso()
    });
    const unreadCount = await getUnreadCount(userId);
    emitToUser(userId, 'notification:count', { unreadCount });
    emitToUser(userId, 'notification:updated', updated);
    return updated;
  }

  return notification;
}

async function markAllNotificationsRead(userId) {
  const rows = await notificationModel.list({
    where: { userId: String(userId || '') },
    orderBy: 'created_at DESC'
  });
  const unread = rows.filter((row) => !row.isRead);
  for (const notification of unread) {
    await notificationModel.update(notification.id, {
      isRead: true,
      readAt: nowIso()
    });
  }

  const unreadCount = 0;
  emitToUser(userId, 'notification:count', { unreadCount });
  emitToUser(userId, 'notification:updated-many', { unreadCount });
  return { updated: unread.length };
}

async function createNotificationRecord(data = {}) {
  return notificationModel.create({
    recipientType: data.recipientType || 'user',
    userId: data.userId || null,
    clientId: data.clientId || null,
    moduleName: normalizeText(data.moduleName, 'general'),
    eventKey: normalizeText(data.eventKey, 'updated'),
    entityType: normalizeText(data.entityType, data.moduleName || 'general'),
    entityId: normalizeText(data.entityId, ''),
    title: normalizeText(data.title, 'Notification'),
    message: normalizeText(data.message, ''),
    severity: normalizeText(data.severity, 'info'),
    isRead: Boolean(data.isRead),
    readAt: data.readAt || null,
    emailTo: normalizeText(data.emailTo, ''),
    emailStatus: normalizeText(data.emailStatus, 'pending'),
    emailSentAt: data.emailSentAt || null,
    emailError: normalizeText(data.emailError, ''),
    actorUserId: data.actorUserId || null,
    routePath: normalizeText(data.routePath, ''),
    channels: toArray(data.channels),
    payload: data.payload || {}
  });
}

async function createInternalNotification({
  user,
  moduleName,
  eventKey,
  entity = {},
  title,
  message,
  severity = 'info',
  actorUserId = null,
  clientId = null,
  routePath = '',
  payload = {},
  channels = null
}) {
  const mergedRoutePath = buildRoutePath(moduleName, entity, routePath);
  const notification = await createNotificationRecord({
    recipientType: 'user',
    userId: user.id,
    clientId: clientId || entity.clientId || null,
    moduleName,
    eventKey,
    entityType: entity.entityType || moduleName,
    entityId: entity.id || entity.entityId || '',
    title,
    message,
    severity,
    actorUserId,
    routePath: mergedRoutePath,
    channels: channels || roleChannels(user.roles?.[0] || {}),
    payload: {
      ...payload,
      routePath: mergedRoutePath,
      moduleName,
      eventKey,
      entityType: entity.entityType || moduleName,
      entityId: entity.id || entity.entityId || '',
      clientId: clientId || entity.clientId || null,
      projectId: entity.projectId || null
    }
  });

  emitToUser(user.id, 'notification:created', notification);
  const unreadCount = await getUnreadCount(user.id);
  emitToUser(user.id, 'notification:count', { unreadCount });
  return notification;
}

async function resolveRecipientUsers({
  moduleName,
  eventKey,
  entity = {},
  explicitUserIds = [],
  actorUserId = null
}) {
  const users = await listUsers();
  const defaultRoles = DEFAULT_INTERNAL_ROLES_BY_MODULE[moduleName] || ['admin'];
  const explicit = new Set(toArray(explicitUserIds));
  if (actorUserId) {
    explicit.add(String(actorUserId));
  }

  const map = new Map();
  for (const user of users) {
    if (!user?.isActive) continue;
    const userRoles = Array.isArray(user.roles) ? user.roles : [];
    const matchesDefault = userRoles.some((role) => defaultRoles.includes(String(role.code || '').trim().toLowerCase()));
    const matchesExplicit = explicit.has(String(user.id));
    const matchesSettings = userRoles.some((role) => roleAllowsNotification(role, moduleName, eventKey));

    if (!matchesDefault && !matchesExplicit && !matchesSettings) {
      continue;
    }

    const channels = new Set();
    userRoles.forEach((role) => {
      if (roleAllowsNotification(role, moduleName, eventKey)) {
        roleChannels(role).forEach((channel) => channels.add(channel));
      }
    });
    if (!channels.size) {
      channels.add('inApp');
    }

    if (matchesExplicit) {
      channels.add('inApp');
    }

    map.set(String(user.id), {
      user,
      channels: [...channels],
      isExplicit: matchesExplicit,
      roleCodes: userRoles.map((role) => String(role.code || '').trim().toLowerCase()).filter(Boolean)
    });
  }

  return [...map.values()];
}

async function notifyClientEmail({
  clientId,
  title,
  message,
  routePath = '',
  severity = 'info',
  payload = {},
  actorUserId = null,
  moduleName = 'general',
  eventKey = 'updated'
}) {
  if (!clientId) {
    return { sent: false, reason: 'Client missing' };
  }

  const client = await clientModel.findById(clientId);
  const email = String(client?.email || '').trim();
  if (!email) {
    return { sent: false, reason: 'Client email missing' };
  }
  const absoluteRoutePath = toAbsoluteUrl(routePath);

  const notification = await createNotificationRecord({
    recipientType: 'client',
    clientId,
    moduleName,
    eventKey,
    entityType: payload.entityType || moduleName,
    entityId: String(payload.entityId || ''),
    title,
    message,
    severity,
    actorUserId,
    emailTo: email,
    emailStatus: 'pending',
    routePath: absoluteRoutePath || routePath,
    channels: ['email'],
    payload: {
      ...payload,
      clientName: client?.name || client?.companyName || '',
      routePath: absoluteRoutePath || routePath
    }
  });

  const emailResult = await sendNotificationEmail({
    to: email,
    subject: title,
    title,
    message,
    routePath: absoluteRoutePath || routePath,
    severity
  });

  if (emailResult.sent) {
    await notificationModel.update(notification.id, {
      emailStatus: 'sent',
      emailSentAt: nowIso(),
      emailError: ''
    });
  } else {
    await notificationModel.update(notification.id, {
      emailStatus: 'failed',
      emailError: emailResult.reason || 'Email send failed'
    });
  }

  return {
    sent: emailResult.sent,
    notificationId: notification.id,
    reason: emailResult.reason || null
  };
}

async function notifyBusinessEvent({
  moduleName,
  eventKey = 'updated',
  entity = {},
  title,
  message,
  severity = 'info',
  actorUserId = null,
  clientId = null,
  projectId = null,
  explicitUserIds = [],
  routePath = '',
  payload = {},
  notifyClient = false
}) {
  const mergedPayload = {
    ...payload,
    moduleName,
    eventKey,
    entityType: entity.entityType || moduleName,
    entityId: entity.id || entity.entityId || '',
    clientId: clientId || entity.clientId || null,
    projectId: projectId || entity.projectId || null,
    routePath: buildRoutePath(moduleName, entity, routePath)
  };
  const recipientUsers = await resolveRecipientUsers({
    moduleName,
    eventKey,
    entity: { ...entity, clientId, projectId },
    explicitUserIds,
    actorUserId
  });

  const internalNotifications = [];
  for (const recipient of recipientUsers) {
    internalNotifications.push(
      await createInternalNotification({
        user: recipient.user,
        moduleName,
        eventKey,
        entity: { ...entity, clientId, projectId },
        title,
        message,
        severity,
        actorUserId,
        clientId,
        routePath: mergedPayload.routePath,
        payload: mergedPayload,
        channels: recipient.channels
      })
    );
  }

  let clientNotification = null;
  if (notifyClient && clientId) {
    clientNotification = await notifyClientEmail({
      clientId,
      title,
      message,
      routePath: mergedPayload.routePath,
      severity,
      payload: mergedPayload,
      actorUserId,
      moduleName,
      eventKey
    });
  }

  return {
    internalNotifications,
    clientNotification,
    routePath: mergedPayload.routePath
  };
}

module.exports = {
  createInternalNotification,
  createNotificationRecord,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifyBusinessEvent,
  notifyClientEmail,
  resolveRecipientUsers,
  sendNotificationEmail
};
