// Outgoing mailboxes and which mailbox sends each kind of mail. Fixed in code; the credentials
// live in the server env only (Settings → SMTP & Email shows them read-only, like Google Drive).
//
// Env per mailbox (PREFIX = SMTP_BILLING, SMTP_ACCOUNTS, SMTP_HR, SMTP_SUPPORT, SMTP_NOREPLY):
//   <PREFIX>_USER        mailbox address, also the From address (required)
//   <PREFIX>_PASSWORD    mailbox password (required)
//   <PREFIX>_FROM_NAME   optional, defaults to fromName below
//   <PREFIX>_REPLY_TO    optional Reply-To address
//   <PREFIX>_HOST / _PORT / _SECURE  optional; default to the shared SMTP_HOST / SMTP_PORT / SMTP_SECURE
// A mailbox without its own USER + PASSWORD sends through the default account
// (SMTP_USER / SMTP_PASSWORD / SMTP_FROM_EMAIL), so mail keeps going while mailboxes are set up.

const MAILBOXES = {
  billing: {
    label: 'Billing',
    envPrefix: 'SMTP_BILLING',
    fromName: 'Webitof Billing',
    suggestedAddress: 'billing@webitof.com',
    purpose: 'Client money mails: invoices, payment receipts and dues, AMC and renewal reminders.'
  },
  accounts: {
    label: 'Accounts',
    envPrefix: 'SMTP_ACCOUNTS',
    fromName: 'Webitof Accounts',
    suggestedAddress: 'accounts@webitof.com',
    purpose: 'Vendors and internal finance: outsourcing payables, commissions, finance reports.'
  },
  hr: {
    label: 'HR',
    envPrefix: 'SMTP_HR',
    fromName: 'Webitof HR',
    suggestedAddress: 'hr@webitof.com',
    purpose: 'Employees and candidates: payslips, leave, letters, recruitment.'
  },
  support: {
    label: 'Support',
    envPrefix: 'SMTP_SUPPORT',
    fromName: 'Webitof Support',
    suggestedAddress: 'support@webitof.com',
    purpose: 'Client service: project updates and other client notifications.'
  },
  noreply: {
    label: 'No-reply',
    envPrefix: 'SMTP_NOREPLY',
    fromName: 'Webitof',
    suggestedAddress: 'noreply@webitof.com',
    purpose: 'Mails that need no reply: password OTP, staff alerts, digests, system alerts.'
  }
};

// Every mail the ERP sends names its type; the type picks the mailbox.
const MAIL_TYPES = {
  password_reset: { label: 'Password reset OTP', mailbox: 'noreply' },
  staff_notification: { label: 'Staff notifications', mailbox: 'noreply' },
  invoice: { label: 'Invoice email', mailbox: 'billing' },
  amc_reminder: { label: 'AMC reminders', mailbox: 'billing' },
  renewal_reminder: { label: 'Renewal reminders', mailbox: 'billing' },
  outsourcing_alert: { label: 'Outsourcing payable alerts', mailbox: 'accounts' },
  client_notification: { label: 'Client notifications', mailbox: 'support' }
};

const DEFAULT_MAILBOX = 'noreply';

// Accepts a mail type ('invoice') or a mailbox key ('billing'); unknown values use the default mailbox.
function mailboxKeyFor(target) {
  const key = String(target || '').trim();
  if (MAIL_TYPES[key]) return MAIL_TYPES[key].mailbox;
  if (MAILBOXES[key]) return key;
  return DEFAULT_MAILBOX;
}

function mailTypesFor(mailboxKey) {
  return Object.entries(MAIL_TYPES)
    .filter(([, type]) => type.mailbox === mailboxKey)
    .map(([key, type]) => ({ key, label: type.label }));
}

module.exports = {
  DEFAULT_MAILBOX,
  MAILBOXES,
  MAIL_TYPES,
  mailboxKeyFor,
  mailTypesFor
};
