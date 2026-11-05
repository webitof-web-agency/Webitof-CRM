function formatItem(item) {
  if (item == null || item === '') return '';
  if (typeof item !== 'object') return String(item);
  if (Array.isArray(item)) return item.map(formatItem).filter(Boolean).join(', ');
  return String(item.name || item.label || item.title || JSON.stringify(item));
}

// Readable one-line text for objects and arrays shown in table cells, e.g. a master's payload
// becomes "description: Web work · gstRate: 18" instead of "[object Object]".
export function formatStructuredValue(value) {
  if (value == null || value === '') return '-';
  if (typeof value !== 'object' || value instanceof Date) return String(value);
  if (Array.isArray(value)) return value.map(formatItem).filter(Boolean).join(', ') || '-';
  const parts = Object.entries(value)
    .filter(([, entry]) => entry != null && entry !== '' && !(Array.isArray(entry) && !entry.length))
    .map(([key, entry]) => `${key}: ${typeof entry === 'object' ? (Array.isArray(entry) ? formatItem(entry) : JSON.stringify(entry)) : entry}`);
  return parts.length ? parts.join(' · ') : '-';
}
