// Keeps ERP items in their owner's Google Calendar, and (two-way) Google changes in the ERP.
//
// What goes to Google, into the calendar of the person it belongs to:
//   lead_event  meetings / events, reminders and tasks with a date   → owner (or payload.assignedTo)
//   follow_up   every open or completed follow-up (calls included)   → assignee
//   todo        todos with a due date (unless "sync to calendar" is off) → assignee (else creator)
// Attendees with an email get Google's invite (sendUpdates=all); a Google Meet link is added when asked.
//
// From Google (every few minutes, incremental with Google's syncToken):
//   both modes  attendees' Yes / No / Maybe; an ERP item deleted in Google is not put back (until it changes)
//   two_way     time / title / place edits made in Google update the ERP item, and the user's own
//               Google events appear in the ERP as private events (deleted again when deleted in Google)
const crypto = require('crypto');
const { query } = require('../../config/db');
const { createId } = require('../../utils/format');
const { sha256 } = require('../../utils/encryption');
const connections = require('./calendarConnection.service');
const { normalizeAttendees } = require('../notify/attendees');

const TIMEZONE = 'Asia/Kolkata';
const SOURCE_TYPES = ['lead_event', 'follow_up', 'todo'];
// lead_events rows that are calendar entries (notes, calls, quotations and audit rows are not).
const CALENDAR_EVENT_TYPES = ['event', 'meeting', 'visit', 'reminder', 'task'];
const CLOSED_FOLLOW_UP = ['Cancelled', 'Auto-Closed', 'Failed'];
const RECONCILE_DELAY_MS = 2500;
const PULL_WINDOW_DAYS = 7;

// ─── time helpers ────────────────────────────────────────────────────────────────

function istParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function istIso(date, time) {
  if (!date) return null;
  const clean = /^\d{2}:\d{2}/.test(String(time || '')) ? String(time).slice(0, 5) : '00:00';
  const value = new Date(`${String(date).slice(0, 10)}T${clean}:00+05:30`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function addDays(date, days) {
  const value = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function addMinutes(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

function timed(iso) {
  return { dateTime: iso, timeZone: TIMEZONE };
}

function frontendLink(route) {
  const base = require('../../config/googleDrive').getGoogleDriveConfig().frontendUrl || '';
  return base && /^https?:\/\//.test(base) ? `${base}/#${route}` : '';
}

// ─── loading ERP items in one shape ─────────────────────────────────────────────

function payloadOf(row) {
  return row?.payload && typeof row.payload === 'object' ? row.payload : {};
}

async function loadLeadEvent(id) {
  const result = await query(
    `select e.*, coalesce(nullif(l.company_name, ''), nullif(l.name, ''), l.lead_number, '') as lead_label
     from lead_events e
     left join leads l on l.id = coalesce(e.lead_id, case when e.scope_type = 'lead' then e.scope_id end)
     where e.id = $1`,
    [id]
  );
  const row = result.rows[0];
  if (!row) return null;
  const payload = payloadOf(row);
  const type = String(row.event_type || '').toLowerCase();
  if (!CALENDAR_EVENT_TYPES.includes(type) || !row.start_date) return null;
  const fromGoogle = payload.source === 'google_calendar';
  const leadId = row.lead_id || (row.scope_type === 'lead' ? row.scope_id : '');
  const startDate = String(row.start_date).slice(0, 10);
  const endDate = row.end_date ? String(row.end_date).slice(0, 10) : startDate;
  let start;
  let end;
  if (row.start_time) {
    const startIso = istIso(startDate, row.start_time);
    const endIso = row.end_time ? istIso(endDate, row.end_time) : null;
    start = timed(startIso);
    end = timed(endIso && endIso > startIso ? endIso : addMinutes(startIso, type === 'reminder' ? 15 : 60));
  } else {
    start = { date: startDate };
    end = { date: addDays(endDate < startDate ? startDate : endDate, 1) };
  }
  const prefix = { reminder: 'Reminder: ', task: 'Task: ' }[type] || '';
  const route = leadId ? `/app/leads/${leadId}` : '/app/dashboard';
  const lines = [];
  if (row.description) lines.push(row.description);
  if (!fromGoogle) {
    if (row.lead_label) lines.push(`Lead: ${row.lead_label}`);
    const link = frontendLink(route);
    if (link) lines.push(`Open in Webitof ERP: ${link}`);
  }
  return {
    type: 'lead_event',
    id: row.id,
    ownerUserId: String(payload.assignedTo || row.owner_user_id || ''),
    origin: fromGoogle ? 'google' : 'erp',
    summary: fromGoogle ? row.title : `${prefix}${row.title}`,
    description: lines.join('\n\n'),
    location: row.location || payload.meetLink || '',
    start,
    end,
    attendees: normalizeAttendees(payload.attendees),
    wantsMeet: Boolean(payload.addMeetLink) && !payload.meetLink,
    reminderMinutes: type === 'reminder' ? 0 : 15,
    done: false,
    route,
    relatedLabel: row.lead_label || '',
    raw: row
  };
}

async function loadFollowUp(id) {
  const result = await query('select * from follow_ups where id = $1', [id]);
  const row = result.rows[0];
  if (!row || row.deleted_at || !row.due_at || CLOSED_FOLLOW_UP.includes(row.status)) return null;
  const startIso = new Date(row.due_at).toISOString();
  const minutes = Math.max(5, Number(row.expected_duration_minutes || 30));
  const done = row.status === 'Completed';
  const route = `/app/follow-ups?focus=${row.id}`;
  const lines = [];
  // Older auto follow-ups were saved as "First contact SLA" (now "First call").
  const purpose = row.purpose === 'First contact SLA' ? 'First call' : row.purpose;
  if (purpose) lines.push(`Purpose: ${purpose}`);
  if (row.related_entity_label) lines.push(`${row.related_entity_type || 'Record'}: ${row.related_entity_label}`);
  if (row.description) lines.push(row.description);
  if (row.next_action) lines.push(`Next action: ${row.next_action}`);
  const link = frontendLink(route);
  if (link) lines.push(`Open in Webitof ERP: ${link}`);
  const typeLabel = row.follow_up_type ? `${row.follow_up_type} · ` : '';
  const related = row.related_entity_label && !String(row.title || '').includes(row.related_entity_label) ? ` · ${row.related_entity_label}` : '';
  return {
    type: 'follow_up',
    id: row.id,
    ownerUserId: String(row.assigned_to || ''),
    origin: 'erp',
    summary: `${done ? '✓ ' : ''}${typeLabel}${row.title}${related}`,
    description: lines.join('\n\n'),
    location: row.location || '',
    start: timed(startIso),
    end: timed(addMinutes(startIso, minutes)),
    attendees: normalizeAttendees(row.attendees),
    wantsMeet: /video/i.test(String(row.follow_up_type || '')) && !/meet\.google\.com/.test(String(row.location || '')),
    reminderMinutes: 15,
    done,
    route,
    relatedLabel: row.related_entity_label || '',
    raw: row
  };
}

async function loadTodo(id) {
  const result = await query('select * from todos where id = $1', [id]);
  const row = result.rows[0];
  if (!row || row.deleted_at || !row.due_at || row.sync_to_calendar === false) return null;
  const done = row.status === 'done';
  const route = `/app/todos?focus=${row.id}`;
  const lines = [];
  if (row.description) lines.push(row.description);
  const checklist = Array.isArray(row.checklist) ? row.checklist : [];
  if (checklist.length) lines.push(checklist.map((item) => `${item.done ? '☑' : '☐'} ${item.text}`).join('\n'));
  if (row.related_entity_label) lines.push(`${row.related_entity_type || 'Record'}: ${row.related_entity_label}`);
  const link = frontendLink(route);
  if (link) lines.push(`Open in Webitof ERP: ${link}`);
  let start;
  let end;
  if (row.all_day) {
    const day = istParts(row.due_at).date;
    start = { date: day };
    end = { date: addDays(day, 1) };
  } else {
    const startIso = new Date(row.due_at).toISOString();
    start = timed(startIso);
    end = timed(addMinutes(startIso, 30));
  }
  return {
    type: 'todo',
    id: row.id,
    ownerUserId: String(row.assigned_to || row.created_by || ''),
    origin: 'erp',
    summary: `${done ? '✓ ' : ''}Todo · ${row.title}`,
    description: lines.join('\n\n'),
    location: '',
    start,
    end,
    attendees: [],
    wantsMeet: false,
    reminderMinutes: Math.max(0, Number(row.reminder_minutes ?? 15)),
    done,
    route,
    relatedLabel: row.related_entity_label || '',
    raw: row
  };
}

const LOADERS = { lead_event: loadLeadEvent, follow_up: loadFollowUp, todo: loadTodo };

async function loadSource(sourceType, id) {
  const loader = LOADERS[sourceType];
  return loader ? loader(id) : null;
}

// ─── Google event body ──────────────────────────────────────────────────────────

function withClearedTimeFields(value) {
  return value.date ? { date: value.date, dateTime: null, timeZone: null } : { dateTime: value.dateTime, timeZone: value.timeZone, date: null };
}

function buildEventBody(item, { ownerEmail = '' } = {}) {
  const owner = String(ownerEmail || '').toLowerCase();
  const attendees = item.attendees
    .filter((attendee) => attendee.email && attendee.email !== owner)
    .map((attendee) => ({ email: attendee.email, ...(attendee.name ? { displayName: attendee.name } : {}) }));
  const body = {
    summary: item.summary,
    description: item.description,
    location: item.location || '',
    start: withClearedTimeFields(item.start),
    end: withClearedTimeFields(item.end),
    attendees,
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: item.reminderMinutes }] },
    extendedProperties: { private: { erp: '1', erpSourceType: item.type, erpSourceId: item.id } }
  };
  const link = frontendLink(item.route);
  if (link && item.origin !== 'google') body.source = { title: 'Webitof ERP', url: link };
  return body;
}

// What decides "changed since the last push" (response statuses are Google's, not ours).
function bodyHash(body) {
  return sha256(JSON.stringify(body));
}

// Insert needs no nulls; PATCH uses them to clear the other time format.
function forInsert(body) {
  const strip = (value) => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null));
  return { ...body, start: strip(body.start), end: strip(body.end) };
}

function withResponses(body, attendees) {
  const byEmail = new Map(attendees.filter((a) => a.email).map((a) => [a.email, a.responseStatus]));
  return {
    ...body,
    attendees: body.attendees.map((attendee) => {
      const status = byEmail.get(attendee.email);
      return status && status !== 'needsAction' ? { ...attendee, responseStatus: status } : attendee;
    })
  };
}

// ─── links ──────────────────────────────────────────────────────────────────────

async function getLink(sourceType, sourceId) {
  const result = await query('select * from calendar_event_links where source_type = $1 and source_id = $2', [sourceType, sourceId]);
  return result.rows[0] || null;
}

async function getLinkByGoogleId(userId, googleEventId) {
  const result = await query('select * from calendar_event_links where user_id = $1 and google_event_id = $2', [userId, googleEventId]);
  return result.rows[0] || null;
}

async function saveLink(link) {
  await query(
    `insert into calendar_event_links (id, user_id, source_type, source_id, google_calendar_id, google_event_id, origin, etag, pushed_hash, google_updated_at, synced_at, last_error, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), $11, now())
     on conflict (source_type, source_id) do update set user_id = excluded.user_id, google_calendar_id = excluded.google_calendar_id,
       google_event_id = excluded.google_event_id, origin = excluded.origin, etag = excluded.etag, pushed_hash = excluded.pushed_hash,
       google_updated_at = excluded.google_updated_at, synced_at = now(), last_error = excluded.last_error, updated_at = now()`,
    [
      link.id || createId('callink'), link.userId, link.sourceType, link.sourceId, link.calendarId || 'primary', link.googleEventId,
      link.origin || 'erp', link.etag || null, link.pushedHash || null, link.googleUpdatedAt || null, link.lastError || null
    ]
  );
}

async function markLinkError(sourceType, sourceId, message) {
  await query(
    `update calendar_event_links set last_error = $3, synced_at = now(), updated_at = now() where source_type = $1 and source_id = $2`,
    [sourceType, sourceId, String(message || 'Sync failed').slice(0, 300)]
  );
}

async function deleteLink(sourceType, sourceId) {
  await query('delete from calendar_event_links where source_type = $1 and source_id = $2', [sourceType, sourceId]);
}

function isGone(error) {
  return [404, 410].includes(Number(error?.statusCode));
}

async function removeGoogleEvent(link) {
  const access = await connections.clientForUser(link.user_id);
  if (access && link.origin !== 'detached') {
    try {
      await access.client.deleteEvent(link.google_calendar_id, link.google_event_id, { sendUpdates: 'all' });
    } catch (error) {
      if (!isGone(error)) throw error;
    }
  }
  await deleteLink(link.source_type, link.source_id);
}

// ─── ERP → Google ───────────────────────────────────────────────────────────────

// Writes the meeting link Google made back onto the ERP item (without another sync round).
async function storeMeetLink(item, hangoutLink) {
  if (!hangoutLink) return;
  if (item.type === 'lead_event') {
    await query(`update lead_events set payload = jsonb_set(coalesce(payload, '{}'::jsonb), '{meetLink}', to_jsonb($2::text)) where id = $1`, [item.id, hangoutLink]);
  } else if (item.type === 'follow_up') {
    await query(`update follow_ups set location = case when coalesce(location, '') = '' then $2 else location end where id = $1`, [item.id, hangoutLink]);
  }
}

async function pushItem(item, link, access) {
  const { client, connection } = access;
  const calendarId = connection.calendar_id || 'primary';
  const body = buildEventBody(item, { ownerEmail: connection.account_email });
  const hash = bodyHash(body);
  const unchanged = link && link.pushed_hash === hash && (link.origin === 'detached' || !link.last_error);
  if (unchanged) {
    // Nothing the calendar shows changed (or the user deleted it in Google and the item is the same):
    // just mark it checked so the sweep does not pick it up again.
    await query('update calendar_event_links set synced_at = now(), updated_at = now() where id = $1', [link.id]);
    return { skipped: true };
  }
  const sendUpdates = body.attendees.length ? 'all' : 'none';
  const payload = withResponses(body, item.attendees);
  let event = null;
  if (link && link.origin !== 'detached') {
    try {
      event = await client.patchEvent(link.google_calendar_id || calendarId, link.google_event_id, payload, { sendUpdates });
    } catch (error) {
      if (!isGone(error)) throw error;
      event = null;
    }
  }
  if (!event) {
    const insertBody = forInsert(payload);
    if (item.wantsMeet) {
      insertBody.conferenceData = { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } };
    }
    event = await client.insertEvent(calendarId, insertBody, { sendUpdates, conferenceDataVersion: item.wantsMeet ? 1 : 0 });
    if (item.wantsMeet) await storeMeetLink(item, event?.hangoutLink);
  }
  await saveLink({
    id: link?.id,
    userId: connection.user_id,
    sourceType: item.type,
    sourceId: item.id,
    calendarId,
    googleEventId: event.id,
    origin: link?.origin === 'google' ? 'google' : 'erp',
    etag: event.etag,
    pushedHash: hash,
    googleUpdatedAt: event.updated || null
  });
  return { pushed: true, eventId: event.id };
}

// Brings one ERP item's calendar entry in line with the item: create, update, move to the new
// owner's calendar, or delete. Safe to call any number of times.
async function reconcile(sourceType, sourceId) {
  if (!SOURCE_TYPES.includes(sourceType) || !sourceId) return { skipped: true };
  const item = await loadSource(sourceType, sourceId);
  let link = await getLink(sourceType, sourceId);
  if (!item || !item.ownerUserId) {
    if (link) await removeGoogleEvent(link);
    return { removed: Boolean(link) };
  }
  if (link && String(link.user_id) !== item.ownerUserId) {
    // Reassigned: out of the old owner's calendar, into the new one's.
    await removeGoogleEvent(link).catch((error) => console.error('[Calendar] Old owner event not removed:', error.message));
    link = null;
  }
  const access = await connections.clientForUser(item.ownerUserId);
  if (!access) return { skipped: true, reason: 'owner calendar not connected' };
  try {
    const result = await pushItem(item, link, access);
    if (result.pushed) await connections.recordResult(item.ownerUserId, { push: true });
    return result;
  } catch (error) {
    if (link) await markLinkError(sourceType, sourceId, error.message);
    await connections.recordResult(item.ownerUserId, { error: error.message }).catch(() => {});
    throw error;
  }
}

// ─── debounced queue (called from the model hooks) ──────────────────────────────

const timers = new Map();
const running = new Map();

function runQueued(sourceType, sourceId) {
  const key = `${sourceType}:${sourceId}`;
  const previous = running.get(key) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(() => reconcile(sourceType, sourceId))
    .catch((error) => {
      if (!/ECONNREFUSED|does not exist/.test(String(error.message))) {
        console.error(`[Calendar] Sync of ${key} failed:`, error.message);
      }
    })
    .finally(() => {
      if (running.get(key) === next) running.delete(key);
    });
  running.set(key, next);
  return next;
}

let connectionCount = { value: null, at: 0 };

async function anyConnections() {
  if (connectionCount.value !== null && Date.now() - connectionCount.at < 60_000) return connectionCount.value > 0;
  const result = await query('select count(*)::int as n from user_calendar_connections');
  connectionCount = { value: Number(result.rows[0]?.n || 0), at: Date.now() };
  return connectionCount.value > 0;
}

function scheduleReconcile(sourceType, sourceId, delayMs = RECONCILE_DELAY_MS) {
  if (!SOURCE_TYPES.includes(sourceType) || !sourceId) return;
  const key = `${sourceType}:${sourceId}`;
  clearTimeout(timers.get(key));
  const timer = setTimeout(() => {
    timers.delete(key);
    anyConnections()
      .then((has) => (has ? runQueued(sourceType, sourceId) : null))
      .catch(() => {});
  }, delayMs);
  timer.unref?.();
  timers.set(key, timer);
}

// ─── sweep: items changed while the server was down, failed pushes, deleted records ───

const SWEEP_SQL = {
  lead_event: {
    owner: `coalesce(nullif(s.payload->>'assignedTo', ''), s.owner_user_id)`,
    table: 'lead_events',
    newItem: `s.start_date >= (now() at time zone '${TIMEZONE}')::date - 1 and lower(s.event_type) = any($3::text[])`
  },
  follow_up: {
    owner: 's.assigned_to',
    table: 'follow_ups',
    newItem: `s.deleted_at is null and s.due_at >= now() - interval '1 day' and s.status <> all($3::text[])`
  },
  todo: {
    owner: 'coalesce(s.assigned_to, s.created_by)',
    table: 'todos',
    newItem: `s.deleted_at is null and s.due_at >= now() - interval '1 day' and s.sync_to_calendar = true`
  }
};

async function dirtyItems(sourceType, userIds, limit = 300) {
  const spec = SWEEP_SQL[sourceType];
  const extra = sourceType === 'lead_event' ? CALENDAR_EVENT_TYPES : sourceType === 'follow_up' ? [...CLOSED_FOLLOW_UP, 'Completed'] : [];
  const result = await query(
    `select s.id from ${spec.table} s
     left join calendar_event_links l on l.source_type = $2 and l.source_id = s.id
     where ${spec.owner} = any($1::text[])
       and ((l.id is null and ${spec.newItem})
         or (l.id is not null and l.origin <> 'detached' and (s.updated_at > coalesce(l.synced_at, '-infinity'::timestamptz) or l.last_error is not null))
         or (l.id is not null and l.origin = 'detached' and s.updated_at > coalesce(l.synced_at, '-infinity'::timestamptz))
         or (l.id is not null and l.user_id <> ${spec.owner}))
     order by s.updated_at desc limit ${Number(limit)}`,
    sourceType === 'todo' ? [userIds, sourceType] : [userIds, sourceType, extra]
  );
  return result.rows.map((row) => row.id);
}

async function orphanLinks(sourceType) {
  const spec = SWEEP_SQL[sourceType];
  const result = await query(
    `select l.source_id from calendar_event_links l left join ${spec.table} s on s.id = l.source_id
     where l.source_type = $1 and s.id is null limit 300`,
    [sourceType]
  );
  return result.rows.map((row) => row.source_id);
}

async function sweep(userIds) {
  if (!userIds.length) return { reconciled: 0, failed: 0 };
  let reconciled = 0;
  let failed = 0;
  for (const sourceType of SOURCE_TYPES) {
    const ids = [...new Set([...(await dirtyItems(sourceType, userIds)), ...(await orphanLinks(sourceType))])];
    for (const id of ids) {
      try {
        await runQueued(sourceType, id);
        reconciled += 1;
      } catch {
        failed += 1;
      }
    }
  }
  return { reconciled, failed };
}

// ─── Google → ERP ───────────────────────────────────────────────────────────────

function googleTimes(event) {
  const start = event.start || {};
  const end = event.end || {};
  if (start.date) {
    const lastDay = end.date ? addDays(end.date, -1) : start.date;
    return { allDay: true, startDate: start.date, endDate: lastDay < start.date ? start.date : lastDay, startIso: istIso(start.date, '00:00') };
  }
  const startIso = start.dateTime ? new Date(start.dateTime).toISOString() : null;
  const endIso = end.dateTime ? new Date(end.dateTime).toISOString() : startIso;
  if (!startIso) return null;
  const s = istParts(startIso);
  const e = istParts(endIso);
  return {
    allDay: false, startIso, endIso,
    startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
    minutes: Math.max(5, Math.round((new Date(endIso) - new Date(startIso)) / 60000))
  };
}

function stripPrefix(summary, prefixes) {
  let text = String(summary || '').trim();
  for (const prefix of prefixes) {
    if (text.startsWith(prefix)) text = text.slice(prefix.length).trim();
  }
  return text;
}

// Attendee answers (Yes / No / Maybe) onto the ERP item's attendee list.
async function applyResponses(item, event) {
  if (!item || !Array.isArray(event.attendees) || !item.attendees.length) return false;
  const byEmail = new Map(event.attendees.map((a) => [String(a.email || '').toLowerCase(), a.responseStatus]));
  let changed = false;
  const next = item.attendees.map((attendee) => {
    const status = attendee.email ? byEmail.get(attendee.email) : null;
    if (status && status !== attendee.responseStatus) {
      changed = true;
      return { ...attendee, responseStatus: status };
    }
    return attendee;
  });
  if (!changed) return false;
  if (item.type === 'lead_event') {
    await query(`update lead_events set payload = jsonb_set(coalesce(payload, '{}'::jsonb), '{attendees}', $2::jsonb) where id = $1`, [item.id, JSON.stringify(next)]);
  } else if (item.type === 'follow_up') {
    await query('update follow_ups set attendees = $2::jsonb where id = $1', [item.id, JSON.stringify(next)]);
  }
  return true;
}

// Two-way: an edit made in Google onto the ERP item. Returns true when the ERP item changed.
async function applyGoogleEdit(item, event, userId) {
  const times = googleTimes(event);
  if (!times) return false;
  if (item.type === 'follow_up') {
    const location = String(event.location || '');
    const updated = await require('../followUpEngine.service').applyCalendarChange(item.id, {
      dueAt: times.allDay ? null : times.startIso,
      durationMinutes: times.allDay ? null : times.minutes,
      location
    }, userId);
    return Boolean(updated);
  }
  if (item.type === 'todo') {
    const todoModel = require('../../models/todo.model');
    const title = stripPrefix(event.summary, ['✓', 'Todo ·']);
    await todoModel.update(item.id, {
      ...(title ? { title } : {}),
      dueAt: times.startIso,
      allDay: times.allDay
    });
    return true;
  }
  if (item.type === 'lead_event') {
    const leadEventModel = require('../../models/leadEvent.model');
    const type = String(item.raw.event_type || '').toLowerCase();
    const title = item.origin === 'google'
      ? String(event.summary || '(No title)')
      : stripPrefix(event.summary, [{ reminder: 'Reminder:', task: 'Task:' }[type] || '\u0000']);
    await leadEventModel.update(item.id, {
      title: title || item.raw.title,
      location: String(event.location || ''),
      startDate: times.startDate,
      startTime: times.allDay ? '' : times.startTime,
      endDate: times.endDate,
      endTime: times.allDay ? '' : times.endTime,
      ...(item.origin === 'google' ? { description: String(event.description || '') } : {})
    });
    return true;
  }
  return false;
}

// Two-way: a Google event of the user's own becomes a private ERP event.
async function importGoogleEvent(event, connection) {
  const times = googleTimes(event);
  if (!times) return;
  const leadEventModel = require('../../models/leadEvent.model');
  const record = await leadEventModel.create({
    scopeType: 'global',
    scopeId: null,
    leadId: null,
    ownerUserId: connection.user_id,
    visibility: 'only_me',
    allowedUserIds: [],
    allowedTeamIds: [],
    eventType: 'event',
    title: String(event.summary || '(No title)').slice(0, 300),
    description: String(event.description || '').slice(0, 5000),
    location: String(event.location || '').slice(0, 500),
    startDate: times.startDate,
    startTime: times.allDay ? '' : times.startTime,
    endDate: times.endDate,
    endTime: times.allDay ? '' : times.endTime,
    labels: [],
    attachments: [],
    color: '#0ea5e9',
    source: 'google_calendar',
    googleEventId: event.id,
    googleHtmlLink: event.htmlLink || '',
    meetLink: event.hangoutLink || ''
  });
  const item = await loadLeadEvent(record.id);
  await saveLink({
    userId: connection.user_id,
    sourceType: 'lead_event',
    sourceId: record.id,
    calendarId: connection.calendar_id || 'primary',
    googleEventId: event.id,
    origin: 'google',
    etag: event.etag,
    // Already identical: the hook's sync after create has nothing to send back.
    pushedHash: item ? bodyHash(buildEventBody(item, { ownerEmail: connection.account_email })) : null,
    googleUpdatedAt: event.updated || null
  });
}

async function refreshPushedHash(sourceType, sourceId, event, ownerEmail) {
  const item = await loadSource(sourceType, sourceId);
  if (!item) return;
  await query(
    `update calendar_event_links set pushed_hash = $3, etag = $4, google_updated_at = $5, synced_at = now(), last_error = null, updated_at = now()
     where source_type = $1 and source_id = $2`,
    [sourceType, sourceId, bodyHash(buildEventBody(item, { ownerEmail })), event.etag || null, event.updated || null]
  );
}

async function handlePulledEvent(event, connection) {
  const twoWay = connection.sync_mode === 'two_way';
  const link = await getLinkByGoogleId(connection.user_id, event.id);
  const isRecurring = Boolean(event.recurrence?.length || event.recurringEventId);

  if (event.status === 'cancelled') {
    if (!link) return;
    if (link.origin === 'google') {
      if (twoWay) {
        await require('../../models/leadEvent.model').remove(link.source_id);
        await deleteLink(link.source_type, link.source_id);
      }
      return;
    }
    // An ERP item removed from Google by the user: leave the ERP item, don't put it back.
    await query(
      `update calendar_event_links set origin = 'detached', synced_at = now(), updated_at = now() where id = $1`,
      [link.id]
    );
    return;
  }

  if (link) {
    if (link.origin === 'detached') return;
    const item = await loadSource(link.source_type, link.source_id);
    if (!item) return;
    await applyResponses(item, event);
    // Our own last write (same etag), or one-way: nothing else comes back.
    if (!twoWay || (link.etag && link.etag === event.etag)) return;
    if (link.google_updated_at && event.updated && new Date(event.updated) <= new Date(link.google_updated_at)) return;
    const changed = await applyGoogleEdit(item, event, connection.user_id);
    if (changed) await refreshPushedHash(link.source_type, link.source_id, event, connection.account_email);
    return;
  }

  // Not linked: a Google event the ERP did not make. Only two-way imports it; recurring series and
  // events made by the ERP for another record are left alone.
  if (!twoWay || isRecurring || event.extendedProperties?.private?.erp === '1') return;
  await importGoogleEvent(event, connection);
}

async function pullUser(connection) {
  const access = await connections.clientForUser(connection.user_id);
  if (!access) return { skipped: true };
  const { client } = access;
  const calendarId = connection.calendar_id || 'primary';
  let syncToken = connection.sync_token || null;
  let pageToken = null;
  let nextSyncToken = null;
  let count = 0;
  try {
    do {
      const params = syncToken
        ? { syncToken, pageToken, maxResults: 250 }
        : { timeMin: new Date(Date.now() - PULL_WINDOW_DAYS * 86400000).toISOString(), pageToken, maxResults: 250, showDeleted: 'false' };
      // eslint-disable-next-line no-await-in-loop
      const page = await client.listEvents(calendarId, params);
      for (const event of page?.items || []) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await handlePulledEvent(event, connection);
          count += 1;
        } catch (error) {
          console.error(`[Calendar] Google event ${event.id} not applied:`, error.message);
        }
      }
      pageToken = page?.nextPageToken || null;
      nextSyncToken = page?.nextSyncToken || nextSyncToken;
    } while (pageToken);
  } catch (error) {
    // Google dropped the sync token: read the calendar again from scratch next time.
    if (Number(error.statusCode) === 410) {
      await query('update user_calendar_connections set sync_token = null, updated_at = now() where user_id = $1', [connection.user_id]);
      return { reset: true };
    }
    await connections.recordResult(connection.user_id, { error: error.message });
    throw error;
  }
  if (nextSyncToken) {
    await query('update user_calendar_connections set sync_token = $2, updated_at = now() where user_id = $1', [connection.user_id, nextSyncToken]);
  }
  await connections.recordResult(connection.user_id, { pull: true });
  return { events: count };
}

// ─── cycles ─────────────────────────────────────────────────────────────────────

async function syncUser(userId) {
  const connection = await connections.getRow(userId);
  if (!connection || !connection.encrypted_refresh_token || connection.needs_reconnect) {
    return { skipped: true, reason: 'not connected' };
  }
  const pushed = await sweep([String(userId)]);
  const pulled = await pullUser(connection).catch((error) => ({ error: error.message }));
  connectionCount = { value: null, at: 0 };
  return { pushed, pulled, status: await connections.getStatus(userId) };
}

let cycleRunning = false;

async function runCycle() {
  if (cycleRunning) return { skipped: true };
  cycleRunning = true;
  try {
    const active = await connections.listActiveConnections();
    const pushed = await sweep(active.map((row) => String(row.user_id)));
    let pulledUsers = 0;
    for (const connection of active) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await pullUser(connection);
        pulledUsers += 1;
      } catch (error) {
        console.error(`[Calendar] Pull for ${connection.user_id} failed:`, error.message);
      }
    }
    return { users: active.length, pushed, pulledUsers };
  } finally {
    cycleRunning = false;
  }
}

module.exports = {
  // For checks against a real database (scripts / tests), not for callers.
  _internals: { dirtyItems, orphanLinks },
  CALENDAR_EVENT_TYPES,
  SOURCE_TYPES,
  buildEventBody,
  googleTimes,
  istIso,
  istParts,
  loadSource,
  reconcile,
  runCycle,
  scheduleReconcile,
  syncUser
};
