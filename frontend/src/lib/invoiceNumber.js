export function normalizeInvoiceNumber(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const patterns = [
    /^(.+?)[-/](\d{4}(?:-\d{2})?)[-/](\d+)$/,
    /^(.+?)\/(\d{4}(?:-\d{2})?)\/(\d+)$/
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) {
      return `${match[1]}-${match[3]}`;
    }
  }

  return raw;
}

export function formatInvoiceNumber(value = '') {
  return normalizeInvoiceNumber(value);
}
