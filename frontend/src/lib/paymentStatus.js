export const PAYMENT_STATUS_OPTIONS = [
  'Received',
  'Pending Clearance',
  'Cleared',
  'Bounced',
  'Refunded',
  'Reversed'
];

const PAYMENT_SUCCESS = new Set(['Received', 'Cleared']);
const PAYMENT_WARNING = new Set(['Pending Clearance']);
const PAYMENT_DANGER = new Set(['Bounced', 'Reversed']);
const PAYMENT_INFO = new Set(['Refunded']);

const INVOICE_SUCCESS = new Set(['Paid']);
const INVOICE_WARNING = new Set(['Partially Paid']);
const INVOICE_DANGER = new Set(['Overdue', 'Cancelled']);
const INVOICE_INFO = new Set(['Sent']);

export function getPaymentStatusTone(status) {
  const value = String(status || 'Received');
  if (PAYMENT_SUCCESS.has(value)) return 'success';
  if (PAYMENT_WARNING.has(value)) return 'warning';
  if (PAYMENT_DANGER.has(value)) return 'danger';
  if (PAYMENT_INFO.has(value)) return 'info';
  return 'neutral';
}

export function getInvoiceStatusTone(status) {
  const value = String(status || 'Sent');
  if (INVOICE_SUCCESS.has(value)) return 'success';
  if (INVOICE_WARNING.has(value)) return 'warning';
  if (INVOICE_DANGER.has(value)) return 'danger';
  if (INVOICE_INFO.has(value)) return 'info';
  return 'neutral';
}
