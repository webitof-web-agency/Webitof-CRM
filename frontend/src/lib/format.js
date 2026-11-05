// One place for how dates and money are shown, so every page reads the same (India locale, IST).
const LOCALE = 'en-IN';
const TIME_ZONE = 'Asia/Kolkata';

function toDate(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
