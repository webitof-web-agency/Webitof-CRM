const { createRepository, column } = require('./baseModel');
const { withCalendarHooks } = require('../services/googleCalendar/syncHooks');

// Todos with a due date also go to the assignee's Google Calendar (see calendarSync.service).
module.exports = withCalendarHooks('todo', createRepository({
  table: 'todos',
  idPrefix: 'todo',
  columns: [
    column({ key: 'title', db: 'title' }),
    column({ key: 'description', db: 'description' }),
    column({ key: 'status', db: 'status' }),
    column({ key: 'priority', db: 'priority' }),
    column({ key: 'dueAt', db: 'due_at' }),
    column({ key: 'allDay', db: 'all_day', type: 'boolean' }),
    column({ key: 'reminderMinutes', db: 'reminder_minutes', type: 'number' }),
    column({ key: 'assignedTo', db: 'assigned_to' }),
    column({ key: 'createdBy', db: 'created_by' }),
    column({ key: 'relatedEntityType', db: 'related_entity_type' }),
    column({ key: 'relatedEntityId', db: 'related_entity_id' }),
    column({ key: 'relatedEntityLabel', db: 'related_entity_label' }),
    column({ key: 'checklist', db: 'checklist', type: 'json' }),
    column({ key: 'tags', db: 'tags', type: 'json' }),
    column({ key: 'syncToCalendar', db: 'sync_to_calendar', type: 'boolean' }),
    column({ key: 'completedAt', db: 'completed_at' }),
    column({ key: 'completedBy', db: 'completed_by' }),
    column({ key: 'deletedAt', db: 'deleted_at' })
  ],
  searchColumns: ['title', 'description', 'related_entity_label']
}));
