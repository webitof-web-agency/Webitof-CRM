// People invited to a meeting, reminder or follow-up. Stored as a JSON list on the record:
//   { type: 'user' | 'lead_contact' | 'client_contact' | 'client' | 'lead' | 'email',
//     id, name, email, phone, responseStatus }
// 'user' is an employee (gets in-app / push / email / WhatsApp by their own settings);
// everyone else is outside the company and gets email + WhatsApp + the Google invite.
const ATTENDEE_TYPES = new Set(['user', 'lead_contact', 'client_contact', 'client', 'lead', 'email']);
const RESPONSE_STATUSES = new Set(['needsAction', 'accepted', 'declined', 'tentative']);
const MAX_ATTENDEES = 50;

function cleanEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function cleanPhone(value) {
  return String(value || '').replace(/[^\d+]/g, '').slice(0, 20);
}

function normalizeAttendees(value) {
  let list = value;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const type = ATTENDEE_TYPES.has(raw.type) ? raw.type : 'email';
    const email = cleanEmail(raw.email);
    const phone = cleanPhone(raw.phone);
    const id = String(raw.id || '').trim();
    if (type === 'user' && !id) continue;
    if (type !== 'user' && !email && !phone) continue;
    const key = type === 'user' ? `user:${id}` : email ? `email:${email}` : `phone:${phone}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      type,
      id,
      name: String(raw.name || '').trim().slice(0, 120),
      email,
      phone,
      responseStatus: RESPONSE_STATUSES.has(raw.responseStatus) ? raw.responseStatus : 'needsAction'
    });
    if (result.length >= MAX_ATTENDEES) break;
  }
  return result;
}

// Stable identity of an attendee across edits (an employee by id, others by email or phone).
function attendeeKey(attendee = {}) {
  if (attendee.type === 'user' && attendee.id) return `user:${attendee.id}`;
  if (attendee.email) return `email:${attendee.email}`;
  return `phone:${attendee.phone || ''}`;
}

module.exports = { attendeeKey, cleanEmail, cleanPhone, normalizeAttendees };
