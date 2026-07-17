const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'lead_events',
  idPrefix: 'lead-event',
  columns: [
    column({ key: 'leadId', db: 'lead_id' }),
    column({ key: 'scopeType', db: 'scope_type' }),
    column({ key: 'scopeId', db: 'scope_id' }),
    column({ key: 'ownerUserId', db: 'owner_user_id' }),
    column({ key: 'visibility', db: 'visibility' }),
    column({ key: 'allowedUserIds', db: 'allowed_user_ids', type: 'json' }),
    column({ key: 'allowedTeamIds', db: 'allowed_team_ids', type: 'json' }),
    column({ key: 'eventType', db: 'event_type' }),
    column({ key: 'title', db: 'title' }),
    column({ key: 'description', db: 'description' }),
    column({ key: 'startDate', db: 'start_date', type: 'date' }),
    column({ key: 'startTime', db: 'start_time' }),
    column({ key: 'endDate', db: 'end_date', type: 'date' }),
    column({ key: 'endTime', db: 'end_time' }),
    column({ key: 'location', db: 'location' }),
    column({ key: 'labels', db: 'labels', type: 'json' }),
    column({ key: 'attachments', db: 'attachments', type: 'json' }),
    column({ key: 'color', db: 'color' })
  ],
  searchColumns: ['title', 'description', 'location', 'event_type']
});
