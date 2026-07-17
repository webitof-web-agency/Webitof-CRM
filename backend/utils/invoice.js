function getFinancialYear(invoiceDate = new Date()) {
  const date = new Date(invoiceDate);
  if (Number.isNaN(date.getTime())) return '2026-27';
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  const endYear = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYear}`;
}

function getInvoiceMonthYearCode(invoiceDate = new Date()) {
  const date = new Date(invoiceDate);
  if (Number.isNaN(date.getTime())) return '072026';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}${year}`;
}

function normalizeInvoiceNumber(value = '') {
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

function generateInvoiceNumber(settings = {}, sequence = 1, invoiceDate = new Date()) {
  const prefix = settings?.invoice?.prefix || 'INV';
  const formattedSequence = String(sequence).padStart(3, '0');
  return `${prefix}-${formattedSequence}`;
}

module.exports = {
  generateInvoiceNumber,
  getFinancialYear,
  getInvoiceMonthYearCode,
  normalizeInvoiceNumber
};
