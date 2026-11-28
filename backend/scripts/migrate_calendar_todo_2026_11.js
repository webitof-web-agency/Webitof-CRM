// One-off: creates the Google Calendar / todo / notification-channel tables and the todos.view_all
// permission on the current DATABASE_URL, without the rest of the startup setup. The deployed server
// does the same on its next start (ensureDatabase), so this is only needed to use the features
// before deploying. Every statement is "IF NOT EXISTS" / insert-if-missing, so running it twice is safe.
//   node scripts/migrate_calendar_todo_2026_11.js
const { ensureCalendarTodoNotifySchema, seedRbac } = require('../config/initDb');
const { closePool, query } = require('../config/db');

(async () => {
  await ensureCalendarTodoNotifySchema();
  // Catalog rows only (no reset of role grants).
  await seedRbac({ resetDefaultGrants: false });
  const tables = await query(
    `select table_name from information_schema.tables where table_schema = 'public'
       and table_name = any($1::text[]) order by table_name`,
    [['calendar_event_links', 'meeting_notice_state', 'notification_deliveries', 'notification_preferences', 'scheduled_reminder_log', 'todos', 'user_calendar_connections']]
  );
  console.log('Tables present:', tables.rows.map((row) => row.table_name).join(', '));
  await closePool();
})().catch(async (error) => {
  console.error('Migration failed:', error.message);
  await closePool().catch(() => {});
  process.exit(1);
});
