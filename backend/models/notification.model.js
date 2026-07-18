const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'notifications',
  idPrefix: 'notif',
  columns: [
    column({ key: 'recipientType', db: 'recipient_type' }),
    column({ key: 'userId', db: 'user_id' }),
    column({ key: 'clientId', db: 'client_id' }),
    column({ key: 'moduleName', db: 'module_name' }),
    column({ key: 'eventKey', db: 'event_key' }),
    column({ key: 'entityType', db: 'entity_type' }),
    column({ key: 'entityId', db: 'entity_id' }),
    column({ key: 'title', db: 'title' }),
    column({ key: 'message', db: 'message' }),
    column({ key: 'severity', db: 'severity' }),
    column({ key: 'isRead', db: 'is_read', type: 'boolean' }),
    column({ key: 'readAt', db: 'read_at' }),
    column({ key: 'emailTo', db: 'email_to' }),
    column({ key: 'emailStatus', db: 'email_status' }),
    column({ key: 'emailSentAt', db: 'email_sent_at' }),
    column({ key: 'emailError', db: 'email_error' }),
    column({ key: 'actorUserId', db: 'actor_user_id' }),
    column({ key: 'routePath', db: 'route_path' }),
    column({ key: 'channels', db: 'channels', type: 'json' })
  ],
  searchColumns: ['title', 'message', 'module_name', 'event_key', 'entity_type', 'entity_id', 'email_to']
});
