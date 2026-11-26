const nodemailer = require('nodemailer');
const { MAILBOXES, mailboxKeyFor, mailTypesFor } = require('../config/mailSenders');

// One transporter per distinct SMTP login, reused across sends.
const transporters = new Map();

function toBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function env(name) {
  return String(process.env[name] || '').trim();
}

function renderTemplate(template, values = {}) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values[key];
    return value == null ? '' : String(value);
  });
}

// SMTP login from the env under one prefix (SMTP_BILLING, …, or SMTP for the default account).
// Host, port and secure fall back to the shared SMTP_HOST / SMTP_PORT / SMTP_SECURE.
function readAccount(prefix) {
  const username = env(`${prefix}_USER`) || (prefix === 'SMTP' ? env('SMTP_USERNAME') : '');
  const password = env(`${prefix}_PASSWORD`);
  const host = env(`${prefix}_HOST`) || env('SMTP_HOST');
  if (!username || !password || !host) return null;
  const port = Number(env(`${prefix}_PORT`) || env('SMTP_PORT') || 465);
  const secureRaw = env(`${prefix}_SECURE`) || env('SMTP_SECURE');
  return {
    host,
    port,
    secure: toBoolean(secureRaw, port === 465),
    username,
    password,
    fromEmail: env(`${prefix}_FROM_EMAIL`) || username,
    replyTo: env(`${prefix}_REPLY_TO`)
  };
}

// The SMTP account for a mail type ('invoice') or mailbox ('billing'): the mailbox's own login,
// else the default SMTP_USER account (sending under the mailbox's name), else null.
function resolveSmtpConfig(target) {
  const mailbox = mailboxKeyFor(target);
  const meta = MAILBOXES[mailbox];
  // The mailbox's name is shown either way, so a billing mail reads "Webitof Billing" even when
  // it goes out through the default account.
  const fromName = env(`${meta.envPrefix}_FROM_NAME`) || meta.fromName;
  const own = readAccount(meta.envPrefix);
  if (own) return { ...own, fromName, mailbox, source: 'own' };
  const fallback = readAccount('SMTP');
  if (fallback) return { ...fallback, fromName, replyTo: env(`${meta.envPrefix}_REPLY_TO`), mailbox, source: 'default' };
  return null;
}

function getTransporter(smtp) {
  const key = JSON.stringify([smtp.host, smtp.port, smtp.secure, smtp.username, smtp.password]);
  if (!transporters.has(key)) {
    transporters.set(key, nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.username, pass: smtp.password }
    }));
  }
  return transporters.get(key);
}

// mailType picks the mailbox (see config/mailSenders.js); mailbox names one directly.
async function sendMail({ to, cc, bcc, subject, text, html, attachments, replyTo, mailType, mailbox }) {
  const target = mailbox || mailType;
  const smtp = resolveSmtpConfig(target);
  if (!smtp) {
    const label = MAILBOXES[mailboxKeyFor(target)].label;
    throw Object.assign(
      new Error(`Email is not configured: set the ${label} mailbox (or SMTP_USER / SMTP_PASSWORD) in the server .env.`),
      { statusCode: 503 }
    );
  }
  const reply = replyTo || smtp.replyTo;
  return getTransporter(smtp).sendMail({
    from: `"${smtp.fromName.replace(/"/g, '')}" <${smtp.fromEmail}>`,
    to,
    ...(cc ? { cc } : {}),
    ...(bcc ? { bcc } : {}),
    ...(reply ? { replyTo: reply } : {}),
    subject,
    text,
    html,
    ...(attachments?.length ? { attachments } : {})
  });
}

// What Settings → SMTP & Email shows: each mailbox, where its login comes from and what it sends.
// Never includes a password.
function getMailboxStatus() {
  const fallback = readAccount('SMTP');
  return {
    defaultAccount: fallback
      ? { configured: true, address: fallback.fromEmail, host: fallback.host, port: fallback.port }
      : { configured: false },
    mailboxes: Object.entries(MAILBOXES).map(([key, meta]) => {
      const smtp = resolveSmtpConfig(key);
      return {
        key,
        label: meta.label,
        purpose: meta.purpose,
        envPrefix: meta.envPrefix,
        suggestedAddress: meta.suggestedAddress,
        source: smtp ? smtp.source : 'none',
        address: smtp ? smtp.fromEmail : '',
        fromName: smtp ? smtp.fromName : meta.fromName,
        replyTo: smtp ? smtp.replyTo : '',
        host: smtp ? smtp.host : '',
        port: smtp ? smtp.port : null,
        secure: smtp ? smtp.secure : null,
        mailTypes: mailTypesFor(key)
      };
    })
  };
}

async function sendTestMail({ mailbox, to }) {
  const meta = MAILBOXES[mailbox];
  if (!meta) throw Object.assign(new Error('Unknown mailbox'), { statusCode: 400 });
  const smtp = resolveSmtpConfig(mailbox);
  const via = smtp?.source === 'default' ? ` (sent through the default account ${smtp.fromEmail})` : '';
  await sendMail({
    mailbox,
    to,
    subject: `Test mail: ${meta.label} mailbox`,
    text: `This is a test mail from the ${meta.label} mailbox of Webitof ERP${via}. If you can read it, this mailbox works.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111"><p>This is a test mail from the <strong>${meta.label}</strong> mailbox of Webitof ERP${via}.</p><p>If you can read it, this mailbox works.</p></div>`
  });
  return { mailbox, to, from: smtp.fromEmail, source: smtp.source };
}

function buildPasswordResetEmail({ name, otp, minutes }) {
  const subject = 'Webitof CRM Password Reset OTP';
  const safeName = name || 'User';
  const text = `Hello ${safeName},\n\nYour password reset OTP is ${otp}.\nThis OTP expires in ${minutes} minutes.\nIf you did not request this, please ignore this email.\n`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <p>Hello ${safeName},</p>
      <p>Your password reset OTP is <strong style="font-size:20px;letter-spacing:2px">${otp}</strong>.</p>
      <p>This OTP expires in <strong>${minutes} minutes</strong>.</p>
      <p>If you did not request this, please ignore this email.</p>
    </div>
  `;
  return { subject, text, html };
}

async function sendPasswordResetOtpEmail({ name, otp, minutes, to }) {
  const template = buildPasswordResetEmail({ name, otp, minutes });
  return sendMail({
    mailType: 'password_reset',
    to,
    subject: template.subject,
    text: renderTemplate(template.text, { name, otp, minutes }),
    html: renderTemplate(template.html, { name, otp, minutes })
  });
}

module.exports = {
  buildPasswordResetEmail,
  getMailboxStatus,
  resolveSmtpConfig,
  sendMail,
  sendPasswordResetOtpEmail,
  sendTestMail
};
