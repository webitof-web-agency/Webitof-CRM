// Tells the people on a meeting / reminder / follow-up what concerns them, with full details:
//   invited     added to it (or it was just created with them on it)
//   updated     time, place or title changed
//   cancelled   removed from it, or it was deleted / cancelled
// Employees get an in-app notification that also goes to push / email / WhatsApp by their own
// settings. People outside the company (lead / client contacts, typed emails) get an email with a
// calendar file (.ics) and a WhatsApp message. When the organiser's Google Calendar is connected,
// Google already mails them its invite, so only WhatsApp is sent from here.
//
// runDueReminders (every minute): "starting soon" for meetings (15 min before for the team, 1 hour
// before for outside attendees) and due reminders for todos.
const { query } = require('../../config/db');
const { sha256 } = require('../../utils/encryption');
const { attendeeKey } = require('./attendees');
const whatsapp = require('./whatsapp.service');
const { logDelivery } = require('./dispatcher.service');

const NOTICE_TYPES = ['lead_event', 'follow_up'];
const NOTICE_DELAY_MS = 3000;
const TEAM_REMINDER_MINUTES = Number(process.env.MEETING_TEAM_REMINDER_MINUTES || 15);
const GUEST_REMINDER_MINUTES = Number(process.env.MEETING_GUEST_REMINDER_MINUTES || 60);
const FIRE_WINDOW_MS = 10 * 60 * 1000;

const sync = () => require('../googleCalendar/calendarSync.service');

// ─── wording ────────────────────────────────────────────────────────────────────

function kindLabel(item) {
  if (item.type === 'follow_up') {
    const type = String(item.raw.follow_up_type || '').toLowerCase();
    if (/visit/.test(type)) return 'visit';
    if (/meeting|demo/.test(type)) return 'meeting';
    if (/call/.test(type)) return 'call';
    return 'follow-up';
  }
  const type = String(item.raw.event_type || '').toLowerCase();
  return { reminder: 'reminder', task: 'task' }[type] || 'meeting';
}

function plainTitle(item) {
  return String(item.raw.title || item.summary || 'Meeting').trim();
}

function formatWhen(item) {
  const dateFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const timeFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
  if (item.start.date) {
    const day = dateFmt.format(new Date(`${item.start.date}T00:00:00+05:30`));
    return `${day} (all day)`;
  }
  const start = new Date(item.start.dateTime);
  const end = new Date(item.end.dateTime);
  return `${dateFmt.format(start)}, ${timeFmt.format(start)} – ${timeFmt.format(end)} IST`;
}

function startMs(item) {
  return new Date(item.start.dateTime || `${item.start.date}T09:00:00+05:30`).getTime();
}

async function userMap() {
  const { listUsers } = require('../auth.service');
  return new Map((await listUsers()).map((user) => [String(user.id), user]));
}

async function companyName() {
  try {
    const { getSettings } = require('../../models/settings.model');
    return (await getSettings())?.company?.name || 'Webitof';
  } catch {
    return 'Webitof';
  }
}

function detailRows(item, { organizer = '', forGuest = false } = {}) {
  const rows = [
    { label: 'What', value: plainTitle(item) },
    { label: 'When', value: formatWhen(item) }
  ];
  const location = String(item.raw.location || '').trim();
  const meetLink = String(item.raw.payload?.meetLink || '').trim() || (/meet\.google\.com/.test(location) ? location : '');
  if (location && location !== meetLink) rows.push({ label: 'Where', value: location });
  if (meetLink) rows.push({ label: 'Video call', value: meetLink });
  if (organizer) rows.push({ label: 'Organiser', value: organizer });
  if (!forGuest && item.relatedLabel) rows.push({ label: 'Related to', value: item.relatedLabel });
  const agenda = String(item.raw.description || item.raw.purpose || '').trim();
  if (agenda) rows.push({ label: forGuest ? 'Agenda' : 'Notes', value: agenda.slice(0, 500) });
  return rows;
}

// ─── calendar file (.ics) for guests whose invite Google does not send ──────────

function icsDate(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsText(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function buildIcs(item, { method = 'REQUEST', organizerName = '', organizerEmail = '', attendee }) {
  const uid = `${item.type}-${item.id}@webitof-erp`;
  const lines = [
    'BEGIN:VCALENDAR', 'PRODID:-//Webitof//ERP//EN', 'VERSION:2.0', 'CALSCALE:GREGORIAN', `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `SEQUENCE:${Math.floor(Date.now() / 1000)}`
  ];
  if (item.start.date) {
    lines.push(`DTSTART;VALUE=DATE:${item.start.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${item.end.date.replace(/-/g, '')}`);
  } else {
    lines.push(`DTSTART:${icsDate(item.start.dateTime)}`, `DTEND:${icsDate(item.end.dateTime)}`);
  }
  lines.push(
    `SUMMARY:${icsText(plainTitle(item))}`,
    `DESCRIPTION:${icsText(String(item.raw.description || item.raw.purpose || ''))}`,
    `LOCATION:${icsText(item.raw.location || '')}`,
    `STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`
  );
  if (organizerEmail) lines.push(`ORGANIZER;CN=${icsText(organizerName)}:mailto:${organizerEmail}`);
  if (attendee?.email) lines.push(`ATTENDEE;CN=${icsText(attendee.name || attendee.email)};RSVP=TRUE:mailto:${attendee.email}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

// ─── sending ────────────────────────────────────────────────────────────────────

const WORDING = {
  invited: { staff: (k) => `You are invited: ${k}`, guest: 'Invitation' },
  updated: { staff: () => 'Updated', guest: 'Updated' },
  cancelled: { staff: () => 'Cancelled', guest: 'Cancelled' },
  starting_soon: { staff: () => 'Starting soon', guest: 'Reminder' }
};

async function notifyStaff({ user, item, change, organizer, actorUserId }) {
  const notifications = require('../notification.service');
  const kind = kindLabel(item);
  const title = `${WORDING[change].staff(kind)}: ${plainTitle(item)}`;
  const messages = {
    invited: `${organizer || 'A colleague'} added you to a ${kind} on ${formatWhen(item)}.`,
    updated: `The ${kind} you are on has changed. It is now on ${formatWhen(item)}.`,
    cancelled: `The ${kind} on ${formatWhen(item)} was cancelled or you were removed from it.`,
    starting_soon: `Your ${kind} starts at ${formatWhen(item)}.`
  };
  await notifications.createInternalNotification({
    user,
    moduleName: 'calendar',
    eventKey: change,
    entity: { id: item.id, entityType: item.type },
    title,
    message: messages[change],
    severity: change === 'cancelled' ? 'warning' : 'info',
    actorUserId: change === 'starting_soon' ? null : actorUserId,
    routePath: item.route,
    payload: { details: detailRows(item, { organizer }), sourceType: item.type, sourceId: item.id }
  });
}

async function notifyGuest({ attendee, item, change, organizer, organizerEmail, googleSendsInvite }) {
  const company = await companyName();
  const kind = kindLabel(item);
  const title = `${WORDING[change].guest}: ${plainTitle(item)}`;
  const messages = {
    invited: `${organizer || company} from ${company} has invited you to a ${kind}.`,
    updated: `The ${kind} with ${company} has been updated. Please see the new details below.`,
    cancelled: `The ${kind} with ${company} has been cancelled.`,
    starting_soon: `This is a reminder of your ${kind} with ${company}.`
  };
  const details = detailRows(item, { organizer: organizer ? `${organizer}, ${company}` : company, forGuest: true });
  const message = messages[change];

  // Email: Google's own invite covers invited / updated / cancelled when the organiser is connected.
  if (attendee.email && !(googleSendsInvite && change !== 'starting_soon')) {
    const { sendNotificationEmail } = require('../notification.service');
    const attachments = change === 'starting_soon' ? [] : [{
      filename: 'invite.ics',
      content: buildIcs(item, { method: change === 'cancelled' ? 'CANCEL' : 'REQUEST', organizerName: organizer, organizerEmail, attendee }),
      contentType: `text/calendar; charset=utf-8; method=${change === 'cancelled' ? 'CANCEL' : 'REQUEST'}`
    }];
    const result = await sendNotificationEmail({
      mailType: 'client_notification', to: attendee.email, subject: title, title, message, routePath: '', details, attachments,
      severity: change === 'cancelled' ? 'warning' : 'info'
    });
    await logDelivery({ recipient: attendee.email, channel: 'email', status: result.sent ? 'sent' : 'failed', error: result.reason, payload: { sourceType: item.type, sourceId: item.id, change, guest: true } });
  }
  if (attendee.phone && whatsapp.isConfigured()) {
    const result = await whatsapp.sendTemplate({
      to: attendee.phone,
      params: whatsapp.notificationParams({ name: attendee.name, title, message, details, link: String(item.raw.payload?.meetLink || '') })
    }).catch((error) => ({ sent: false, reason: error.message }));
    await logDelivery({ recipient: attendee.phone, channel: 'whatsapp', status: result.sent ? 'sent' : 'failed', error: result.reason, payload: { sourceType: item.type, sourceId: item.id, change, guest: true } });
  }
}

async function organiserInfo(item, users) {
  const owner = users.get(String(item?.ownerUserId || ''));
  const connection = owner ? await require('../googleCalendar/calendarConnection.service').getRow(owner.id).catch(() => null) : null;
  return {
    owner,
    organizer: owner?.fullName || '',
    organizerEmail: connection?.account_email || owner?.email || '',
    googleSendsInvite: Boolean(connection?.encrypted_refresh_token && !connection.needs_reconnect)
  };
}

async function sendChange({ attendee, item, change, users, info }) {
  if (attendee.type === 'user') {
    const user = users.get(String(attendee.id));
    if (!user || user.isActive === false || String(user.id) === String(item.ownerUserId)) return;
    await notifyStaff({ user, item, change, organizer: info.organizer, actorUserId: item.ownerUserId || null });
    return;
  }
  await notifyGuest({ attendee, item, change, ...info });
}

// ─── change notices (after every write) ─────────────────────────────────────────

function scheduleHash(item) {
  return item ? sha256(JSON.stringify([plainTitle(item), item.start, item.end, item.raw.location || ''])) : '';
}

async function processNotice(sourceType, sourceId) {
  const stateResult = await query('select * from meeting_notice_state where source_type = $1 and source_id = $2', [sourceType, sourceId]);
  const state = stateResult.rows[0] || null;
  const loaded = await sync().loadSource(sourceType, sourceId);
  // Completed follow-ups are history: nobody is told anything new about them.
  const item = loaded && !loaded.done ? loaded : null;
  const current = item ? item.attendees : [];
  const previous = Array.isArray(state?.attendees) ? state.attendees : [];
  if (!state && !current.length) return;

  const users = await userMap();
  const hash = scheduleHash(item);
  const currentKeys = new Map(current.map((attendee) => [attendeeKey(attendee), attendee]));
  const previousKeys = new Map(previous.map((attendee) => [attendeeKey(attendee), attendee]));
  const scheduleChanged = Boolean(state) && state.schedule_hash !== hash;

  // A cancelled / deleted item still needs its old details for the "cancelled" message.
  const cancelledItem = item || (previous.length && state?.item?.raw ? { ...state.item, attendees: previous } : null);

  if (item) {
    const info = await organiserInfo(item, users);
    for (const [key, attendee] of currentKeys) {
      if (!previousKeys.has(key)) await sendChange({ attendee, item, change: 'invited', users, info });
      else if (scheduleChanged) await sendChange({ attendee, item, change: 'updated', users, info });
    }
    for (const [key, attendee] of previousKeys) {
      if (!currentKeys.has(key)) await sendChange({ attendee, item, change: 'cancelled', users, info });
    }
  } else if (cancelledItem?.raw) {
    const info = await organiserInfo(cancelledItem, users);
    for (const attendee of previous) await sendChange({ attendee, item: cancelledItem, change: 'cancelled', users, info });
  }

  if (!item || !current.length) {
    await query('delete from meeting_notice_state where source_type = $1 and source_id = $2', [sourceType, sourceId]);
    return;
  }
  // Enough of the item is kept to word a "cancelled" message after it is deleted.
  const lastItem = { type: item.type, id: item.id, ownerUserId: item.ownerUserId, start: item.start, end: item.end, route: item.route, relatedLabel: item.relatedLabel, summary: item.summary, raw: { title: item.raw.title, description: item.raw.description, purpose: item.raw.purpose, location: item.raw.location, event_type: item.raw.event_type, follow_up_type: item.raw.follow_up_type, payload: { meetLink: item.raw.payload?.meetLink || '' } } };
  await query(
    `insert into meeting_notice_state (source_type, source_id, attendees, schedule_hash, item, updated_at)
     values ($1, $2, $3::jsonb, $4, $5::jsonb, now())
     on conflict (source_type, source_id) do update set attendees = excluded.attendees, schedule_hash = excluded.schedule_hash,
       item = excluded.item, updated_at = now()`,
    [sourceType, sourceId, JSON.stringify(current), hash, JSON.stringify(lastItem)]
  );
}

const timers = new Map();

function scheduleNotice(sourceType, sourceId) {
  if (!NOTICE_TYPES.includes(sourceType) || !sourceId) return;
  const key = `${sourceType}:${sourceId}`;
  clearTimeout(timers.get(key));
  const timer = setTimeout(() => {
    timers.delete(key);
    processNotice(sourceType, sourceId).catch((error) => {
      if (!/ECONNREFUSED|does not exist/.test(String(error.message))) console.error(`[Notify] Notice for ${key} failed:`, error.message);
    });
  }, NOTICE_DELAY_MS);
  timer.unref?.();
  timers.set(key, timer);
}

// ─── reminders (every minute) ───────────────────────────────────────────────────

async function firstTime(key) {
  const result = await query('insert into scheduled_reminder_log (key) values ($1) on conflict (key) do nothing returning key', [key]);
  return result.rowCount > 0;
}

function due(atMs, offsetMinutes, now) {
  const fireAt = atMs - offsetMinutes * 60000;
  return now >= fireAt && now - fireAt < FIRE_WINDOW_MS;
}

async function remindItem(item, users, now) {
  const at = startMs(item);
  const info = await organiserInfo(item, users);
  const teamOffset = String(item.raw.event_type || '').toLowerCase() === 'reminder' ? 0 : TEAM_REMINDER_MINUTES;
  const staff = new Map();
  if (item.type === 'lead_event' && item.ownerUserId) staff.set(item.ownerUserId, true);
  for (const attendee of item.attendees) {
    if (attendee.type === 'user') staff.set(String(attendee.id), true);
  }
  const startKey = item.start.dateTime || item.start.date;
  for (const userId of staff.keys()) {
    const user = users.get(String(userId));
    if (!user || user.isActive === false) continue;
    if (!due(at, teamOffset, now)) continue;
    // eslint-disable-next-line no-await-in-loop
    if (!(await firstTime(`soon:${item.type}:${item.id}:${startKey}:user:${userId}`))) continue;
    // eslint-disable-next-line no-await-in-loop
    await notifyStaff({ user, item, change: 'starting_soon', organizer: info.organizer, actorUserId: null });
  }
  for (const attendee of item.attendees) {
    if (attendee.type === 'user' || !due(at, GUEST_REMINDER_MINUTES, now)) continue;
    // eslint-disable-next-line no-await-in-loop
    if (!(await firstTime(`soon:${item.type}:${item.id}:${startKey}:${attendeeKey(attendee)}`))) continue;
    // eslint-disable-next-line no-await-in-loop
    await notifyGuest({ attendee, item, change: 'starting_soon', ...info });
  }
}

async function remindTodos(users, now) {
  const notifications = require('../notification.service');
  const result = await query(
    `select * from todos where deleted_at is null and status <> 'done' and due_at is not null
       and due_at between now() - interval '15 minutes' and now() + interval '1 day 10 minutes'`
  );
  for (const row of result.rows) {
    const at = new Date(row.due_at).getTime();
    const owner = users.get(String(row.assigned_to || row.created_by || ''));
    if (!owner || owner.isActive === false) continue;
    const offsets = [...new Set([Number(row.reminder_minutes || 0), 0])].filter((value) => value >= 0);
    for (const offset of offsets) {
      if (row.all_day && offset === 0) continue;
      if (!due(at, offset, now)) continue;
      // eslint-disable-next-line no-await-in-loop
      if (!(await firstTime(`todo:${row.id}:${new Date(row.due_at).toISOString()}:${offset}`))) continue;
      const todoService = require('../todo.service');
      // eslint-disable-next-line no-await-in-loop
      await notifications.createInternalNotification({
        user: owner,
        moduleName: 'todos',
        eventKey: offset === 0 ? 'due_now' : 'due_soon',
        entity: { id: row.id, entityType: 'todo' },
        title: offset === 0 ? `Todo due now: ${row.title}` : `Todo due in ${offset} min: ${row.title}`,
        message: row.description ? String(row.description).slice(0, 200) : 'This todo is due.',
        severity: offset === 0 ? 'warning' : 'info',
        routePath: `/app/todos?focus=${row.id}`,
        payload: { details: todoService.todoDetails(row, users) }
      });
    }
  }
}

let remindersRunning = false;

async function runDueReminders() {
  if (remindersRunning) return { skipped: true };
  remindersRunning = true;
  try {
    const now = Date.now();
    const users = await userMap();
    const { CALENDAR_EVENT_TYPES, loadSource } = sync();
    const events = await query(
      `select id from lead_events where lower(event_type) = any($1::text[]) and coalesce(start_time, '') <> ''
         and start_date between (now() at time zone 'Asia/Kolkata')::date and (now() at time zone 'Asia/Kolkata')::date + 1`,
      [CALENDAR_EVENT_TYPES]
    );
    const followUps = await query(
      `select id from follow_ups where deleted_at is null and status not in ('Completed','Cancelled','Auto-Closed','Failed')
         and jsonb_array_length(coalesce(attendees, '[]'::jsonb)) > 0
         and due_at between now() - interval '15 minutes' and now() + interval '2 hours'`
    );
    const targets = [
      ...events.rows.map((row) => ['lead_event', row.id]),
      ...followUps.rows.map((row) => ['follow_up', row.id])
    ];
    for (const [type, id] of targets) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const item = await loadSource(type, id);
        // eslint-disable-next-line no-await-in-loop
        if (item && !item.done && item.start.dateTime) await remindItem(item, users, now);
      } catch (error) {
        console.error(`[Notify] Reminder for ${type}:${id} failed:`, error.message);
      }
    }
    await remindTodos(users, now);
    await query(`delete from scheduled_reminder_log where created_at < now() - interval '45 days'`).catch(() => {});
    return { checked: targets.length };
  } finally {
    remindersRunning = false;
  }
}

module.exports = { buildIcs, formatWhen, processNotice, runDueReminders, scheduleNotice };
