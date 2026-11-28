// Wraps a repository (models/*.model.js) so every create / update / remove of a meeting, follow-up
// or todo schedules a Google Calendar sync and the attendee notices for that record. The work runs a
// moment later, after the request's transaction has committed, and re-reads the record, so a rolled
// back change simply finds the old state. The periodic sweep (calendarSync.runCycle) catches anything
// missed by a restart.
function schedule(sourceType, id) {
  if (!id || String(process.env.CALENDAR_SYNC_DISABLED || '').toLowerCase() === 'true') return;
  // Lazy: the sync services load models themselves.
  require('./calendarSync.service').scheduleReconcile(sourceType, String(id));
  require('../notify/meetingNotify.service').scheduleNotice(sourceType, String(id));
}

function withCalendarHooks(sourceType, repository) {
  return {
    ...repository,
    async create(data, dbClient) {
      const record = await repository.create(data, dbClient);
      if (record?.id) schedule(sourceType, record.id);
      return record;
    },
    async update(id, patch, dbClient) {
      const record = await repository.update(id, patch, dbClient);
      if (record?.id) schedule(sourceType, record.id);
      return record;
    },
    async remove(id, dbClient) {
      const current = await repository.findById(id, dbClient);
      const removed = await repository.remove(id, dbClient);
      if (removed) schedule(sourceType, current?.id || id);
      return removed;
    }
  };
}

module.exports = { schedule, withCalendarHooks };
