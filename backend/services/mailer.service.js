const nodemailer = require('nodemailer');
const { getSettings } = require('../models/settings.model');

let cachedTransporterKey = '';
let cachedTransporter = null;

function toBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function renderTemplate(template, values = {}) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values[key];
    return value == null ? '' : String(value);
  });
}

async function resolveSmtpConfig() {
  const settings = await getSettings();
  const smtp = settings?.smtp || {};
  const host = String(smtp.host || process.env.SMTP_HOST || '').trim();
  const port = Number(smtp.port || process.env.SMTP_PORT || 465);
  const username = String(smtp.username || process.env.SMTP_USER || process.env.SMTP_USERNAME || '').trim();
  const password = String(smtp.password || process.env.SMTP_PASSWORD || '').trim();
  const fromEmail = String(smtp.fromEmail || process.env.SMTP_FROM_EMAIL || username || '').trim();
  const fromName = String(smtp.fromName || process.env.SMTP_FROM_NAME || settings?.company?.name || 'Webitof CRM').trim();
  const secure = smtp.secure != null ? toBoolean(smtp.secure, port === 465) : toBoolean(process.env.SMTP_SECURE, port === 465);

  if (!host || !port || !username || !password || !fromEmail) {
    return null;
  }

  return {
    fromEmail,
    fromName,
    host,
    password,
    port,
    secure,
    username
  };
}

async function getTransporter() {
  const smtp = await resolveSmtpConfig();
  if (!smtp) {
    throw new Error('SMTP configuration is missing. Please configure Hostinger SMTP in settings or environment variables.');
  }

  const cacheKey = JSON.stringify({
    host: smtp.host,
    password: smtp.password,
    port: smtp.port,
    secure: smtp.secure,
    username: smtp.username
  });

  if (!cachedTransporter || cachedTransporterKey !== cacheKey) {
    cachedTransporterKey = cacheKey;
    cachedTransporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.username,
        pass: smtp.password
      }
    });
  }

  return {
    transporter: cachedTransporter,
    smtp
  };
}

async function sendMail({ to, subject, text, html }) {
  const { transporter, smtp } = await getTransporter();
  return transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to,
    subject,
    text,
    html
  });
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
    to,
    subject: template.subject,
    text: renderTemplate(template.text, { name, otp, minutes }),
    html: renderTemplate(template.html, { name, otp, minutes })
  });
}

module.exports = {
  buildPasswordResetEmail,
  resolveSmtpConfig,
  sendMail,
  sendPasswordResetOtpEmail
};
