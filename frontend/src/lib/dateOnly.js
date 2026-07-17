function pad(value) {
  return String(value).padStart(2, '0');
}

export function parseDateOnly(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const raw = String(value || '').trim();
  if (!raw) return null;

  const direct = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) {
    const [year, month, day] = direct.split('-').map((part) => Number(part));
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateOnlyInput(value) {
  const date = parseDateOnly(value);
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isSameDateOnly(left, right) {
  const leftDate = parseDateOnly(left);
  const rightDate = parseDateOnly(right);
  if (!leftDate || !rightDate) return false;
  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

export function toDateOnlyKey(value) {
  const date = parseDateOnly(value);
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDateOnlyDisplay(value, locale = 'en-IN', options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  const date = parseDateOnly(value);
  if (!date) return String(value || '').slice(0, 10) || '-';
  return date.toLocaleDateString(locale, options);
}
