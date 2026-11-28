// Which channels each kind of notification reaches a user on. The in-app bell always gets it;
// push (phone apps), email and WhatsApp follow the user's own choices, starting from these defaults.
const { query } = require('../../config/db');

const CHANNELS = ['push', 'email', 'whatsapp'];

const CATEGORIES = [
  { key: 'calendar', label: 'Meetings & invites', description: 'Meetings you are invited to, changes, cancellations and "starting soon"' },
  { key: 'followup', label: 'Follow-ups', description: 'Follow-up reminders, assignments and escalations' },
  { key: 'todo', label: 'Todos', description: 'Todos assigned to you, due reminders and completions' },
  { key: 'general', label: 'Other updates', description: 'Lead, client, invoice and other activity' }
];

const DEFAULTS = {
  calendar: { push: true, email: true, whatsapp: true },
  followup: { push: true, email: true, whatsapp: true },
  todo: { push: true, email: true, whatsapp: true },
  general: { push: false, email: false, whatsapp: false }
};

function categoryOf(moduleName = '', eventKey = '') {
  const module = String(moduleName || '').toLowerCase();
  if (module === 'calendar') return 'calendar';
  if (module === 'todos') return 'todo';
  if (module === 'followups' || module === 'follow-ups') return 'followup';
  if (module === 'lead-events' && /invite|meeting|starting/.test(String(eventKey || ''))) return 'calendar';
  return 'general';
}

function merge(saved = {}) {
  const channels = {};
  for (const { key } of CATEGORIES) {
    channels[key] = {};
    for (const channel of CHANNELS) {
      const value = saved?.[key]?.[channel];
      channels[key][channel] = typeof value === 'boolean' ? value : DEFAULTS[key][channel];
    }
  }
  return channels;
}

async function getPreferences(userId) {
  const result = await query(
    `select p.preferences, p.whatsapp_number, u.phone from users u
     left join notification_preferences p on p.user_id = u.id where u.id = $1`,
    [String(userId || '')]
  );
  const row = result.rows[0] || {};
  return {
    channels: merge(row.preferences || {}),
    whatsappNumber: row.whatsapp_number || '',
    // The profile phone is used when no separate WhatsApp number is saved.
    effectiveWhatsappNumber: row.whatsapp_number || row.phone || ''
  };
}

async function savePreferences(userId, { channels = {}, whatsappNumber } = {}) {
  const clean = merge(channels);
  const number = whatsappNumber === undefined ? undefined : String(whatsappNumber || '').replace(/[^\d+ -]/g, '').trim().slice(0, 20);
  await query(
    `insert into notification_preferences (user_id, preferences, whatsapp_number, updated_at)
     values ($1, $2::jsonb, $3, now())
     on conflict (user_id) do update set preferences = excluded.preferences,
       whatsapp_number = coalesce($4, notification_preferences.whatsapp_number), updated_at = now()`,
    [String(userId), JSON.stringify(clean), number ?? null, number === undefined ? null : number]
  );
  return getPreferences(userId);
}

module.exports = { CATEGORIES, CHANNELS, DEFAULTS, categoryOf, getPreferences, savePreferences };
