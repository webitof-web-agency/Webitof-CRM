// One place for how dates and money are shown, so every page reads the same (India locale, IST).
const LOCALE = 'en-IN';
const TIME_ZONE = 'Asia/Kolkata';

function toDate(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// The business runs on Indian time. toISOString() is UTC, which is still "yesterday" between 00:00 and 05:30 IST,
// so "today", "tomorrow" and date-input defaults come from here instead.
const IST_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });
const IST_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

// 2026-11-05: the IST calendar date, offset by whole days from `from`.
export function istDate(offsetDays = 0, from = new Date()) {
  return IST_DATE.format(new Date(from.getTime() + offsetDays * 86400000));
}

// 2026-11-05T14:30: now in IST, in the shape of a datetime-local input.
export function istDateTimeInput(from = new Date()) {
  const parts = IST_PARTS.formatToParts(from).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// 04/11/2026
export function formatDate(value, fallback = '—') {
  const date = toDate(value);
  return date ? date.toLocaleDateString(LOCALE, { timeZone: TIME_ZONE }) : fallback;
}

// 04/11/2026, 3:45:10 pm
export function formatDateTime(value, fallback = '—') {
  const date = toDate(value);
  return date ? date.toLocaleString(LOCALE, { timeZone: TIME_ZONE }) : fallback;
}

// ₹1,23,456.00
export function formatINR(value, { decimals = 2, fallback = '—' } = {}) {
  if (value == null || value === '') return fallback;
  const amount = Number(value);
  if (Number.isNaN(amount)) return fallback;
  return amount.toLocaleString(LOCALE, { style: 'currency', currency: 'INR', minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
