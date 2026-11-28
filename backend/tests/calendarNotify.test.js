// Google Calendar body / time helpers, attendees, WhatsApp formatting and notification routing.
// Pure functions only: no database or network.
process.env.CALENDAR_SYNC_DISABLED = 'true';
const test = require('node:test');
const assert = require('node:assert/strict');

const sync = require('../services/googleCalendar/calendarSync.service');
const { normalizeAttendees, attendeeKey } = require('../services/notify/attendees');
const whatsapp = require('../services/notify/whatsapp.service');
const { categoryOf, DEFAULTS } = require('../services/notify/preferences.service');
const { buildIcs, formatWhen } = require('../services/notify/meetingNotify.service');

function item(overrides = {}) {
  return {
    type: 'follow_up',
    id: 'fu1',
    ownerUserId: 'u1',
    origin: 'erp',
    summary: 'Call · Demo',
    description: 'Agenda',
    location: 'Office',
    start: { dateTime: '2026-11-28T09:30:00.000Z', timeZone: 'Asia/Kolkata' },
    end: { dateTime: '2026-11-28T10:00:00.000Z', timeZone: 'Asia/Kolkata' },
    attendees: [],
    wantsMeet: false,
    reminderMinutes: 15,
    done: false,
    route: '/app/follow-ups?focus=fu1',
    raw: { title: 'Demo', description: 'Agenda', location: 'Office' },
    ...overrides
  };
}

test('IST helpers convert both ways', () => {
  assert.equal(sync.istIso('2026-11-28', '15:00'), '2026-11-28T09:30:00.000Z');
  assert.deepEqual(sync.istParts('2026-11-28T09:30:00Z'), { date: '2026-11-28', time: '15:00' });
  // Late evening UTC is the next day in IST.
  assert.equal(sync.istParts('2026-11-28T20:00:00Z').date, '2026-11-29');
});

test('Google all-day end date is exclusive', () => {
  const times = sync.googleTimes({ start: { date: '2026-11-28' }, end: { date: '2026-11-30' } });
  assert.equal(times.allDay, true);
  assert.equal(times.startDate, '2026-11-28');
  assert.equal(times.endDate, '2026-11-29');
});

test('Google timed event gives IST date, time and duration', () => {
  const times = sync.googleTimes({ start: { dateTime: '2026-11-28T15:00:00+05:30' }, end: { dateTime: '2026-11-28T16:15:00+05:30' } });
  assert.equal(times.allDay, false);
  assert.equal(times.startTime, '15:00');
  assert.equal(times.endTime, '16:15');
  assert.equal(times.minutes, 75);
});

test('event body: invitees with email only, never the organiser, and ERP markers', () => {
  const body = sync.buildEventBody(item({
    attendees: normalizeAttendees([
      { type: 'client_contact', name: 'Asha', email: 'asha@client.com' },
      { type: 'user', id: 'u2', name: 'Ravi', email: 'owner@webitof.com' },
      { type: 'lead_contact', name: 'No email', phone: '9876543210' }
    ])
  }), { ownerEmail: 'owner@webitof.com' });
  assert.deepEqual(body.attendees, [{ email: 'asha@client.com', displayName: 'Asha' }]);
  assert.deepEqual(body.extendedProperties.private, { erp: '1', erpSourceType: 'follow_up', erpSourceId: 'fu1' });
  assert.equal(body.start.date, null);
  assert.equal(body.reminders.overrides[0].minutes, 15);
});

test('event body: all-day items clear the time fields', () => {
  const body = sync.buildEventBody(item({ start: { date: '2026-11-28' }, end: { date: '2026-11-29' } }));
  assert.deepEqual(body.start, { date: '2026-11-28', dateTime: null, timeZone: null });
});

test('attendees are cleaned and de-duplicated', () => {
  const list = normalizeAttendees([
    { type: 'user', id: 'u1', name: 'A' },
    { type: 'user', id: 'u1', name: 'A again' },
    { type: 'email', email: 'X@Example.com' },
    { type: 'email', email: 'x@example.com' },
    { type: 'email', email: 'not-an-email' },
    { type: 'weird', phone: '+91 98765-43210' }
  ]);
  assert.equal(list.length, 3);
  assert.equal(list[1].email, 'x@example.com');
  assert.equal(list[2].type, 'email');
  assert.equal(list[2].phone, '+919876543210');
  assert.equal(attendeeKey(list[0]), 'user:u1');
  assert.equal(normalizeAttendees('not json').length, 0);
});

test('WhatsApp numbers get the country code and params lose new lines', () => {
  assert.equal(whatsapp.normalizePhone('98765 43210'), '919876543210');
  assert.equal(whatsapp.normalizePhone('+91 98765-43210'), '919876543210');
  assert.equal(whatsapp.normalizePhone('12'), '');
  assert.equal(whatsapp.cleanParam('a\nb\t\tc     d'), 'a | b | c d');
  const params = whatsapp.notificationParams({ name: 'Ravi', title: 'Invite', message: 'Hi', details: [{ label: 'When', value: 'Today' }], link: '' });
  assert.deepEqual(params, ['Ravi', 'Invite', 'Hi | When: Today', '-']);
});

test('notification categories and defaults', () => {
  assert.equal(categoryOf('calendar', 'invited'), 'calendar');
  assert.equal(categoryOf('todos', 'assigned'), 'todo');
  assert.equal(categoryOf('followups', 'reminder_due'), 'followup');
  assert.equal(categoryOf('leads', 'updated'), 'general');
  assert.equal(DEFAULTS.general.email, false);
  assert.equal(DEFAULTS.calendar.whatsapp, true);
});

test('calendar file (.ics) escapes text and marks cancellations', () => {
  const ics = buildIcs(item({ raw: { title: 'Demo, call; x', description: 'a\nb', location: '' } }), {
    method: 'CANCEL', organizerName: 'Ravi', organizerEmail: 'ravi@webitof.com', attendee: { email: 'asha@client.com', name: 'Asha' }
  });
  assert.match(ics, /METHOD:CANCEL/);
  assert.match(ics, /STATUS:CANCELLED/);
  assert.match(ics, /SUMMARY:Demo\\, call\\; x/);
  assert.match(ics, /DESCRIPTION:a\\nb/);
  assert.match(ics, /DTSTART:20261128T093000Z/);
  assert.match(formatWhen(item()), /3:00\s?pm – 3:30\s?pm IST/i);
});
