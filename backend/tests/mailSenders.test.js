// Five outgoing mailboxes, env only: each mail type picks its mailbox, a mailbox without its own
// login falls back to the default SMTP_USER account, and the status never exposes a password.
const test = require('node:test');
const assert = require('node:assert/strict');

const { MAILBOXES, MAIL_TYPES, mailboxKeyFor } = require('../config/mailSenders');
const mailer = require('../services/mailer.service');
const settingsModel = require('../models/settings.model');

const SMTP_ENV = Object.keys(process.env).filter((key) => key.startsWith('SMTP_'));

function withEnv(t, values) {
  const saved = {};
  for (const key of [...SMTP_ENV, ...Object.keys(values)]) saved[key] = process.env[key];
  for (const key of SMTP_ENV) delete process.env[key];
  Object.assign(process.env, values);
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

const SHARED = { SMTP_HOST: 'smtp.hostinger.com', SMTP_PORT: '465', SMTP_SECURE: 'true' };

test('every mail type names a known mailbox; the five mailboxes are fixed', () => {
  assert.deepEqual(Object.keys(MAILBOXES).sort(), ['accounts', 'billing', 'hr', 'noreply', 'support']);
  for (const [key, type] of Object.entries(MAIL_TYPES)) assert.ok(MAILBOXES[type.mailbox], key);
  assert.equal(mailboxKeyFor('invoice'), 'billing');
  assert.equal(mailboxKeyFor('password_reset'), 'noreply');
  assert.equal(mailboxKeyFor('outsourcing_alert'), 'accounts');
  assert.equal(mailboxKeyFor('client_notification'), 'support');
  assert.equal(mailboxKeyFor('hr'), 'hr');
  assert.equal(mailboxKeyFor('something_else'), 'noreply');
});

test('a mailbox with its own login sends as itself; shared host/port apply', (t) => {
  withEnv(t, { ...SHARED, SMTP_BILLING_USER: 'billing@webitof.com', SMTP_BILLING_PASSWORD: 'x', SMTP_BILLING_REPLY_TO: 'accounts@webitof.com' });
  const smtp = mailer.resolveSmtpConfig('invoice');
  assert.equal(smtp.source, 'own');
  assert.equal(smtp.mailbox, 'billing');
  assert.equal(smtp.fromEmail, 'billing@webitof.com');
  assert.equal(smtp.fromName, 'Webitof Billing');
  assert.equal(smtp.replyTo, 'accounts@webitof.com');
  assert.equal(smtp.host, 'smtp.hostinger.com');
  assert.equal(smtp.port, 465);
  assert.equal(smtp.secure, true);
});

test('without its own login a mailbox uses the default account under its own name', (t) => {
  withEnv(t, { ...SHARED, SMTP_USER: 'contact@webitof.com', SMTP_PASSWORD: 'x', SMTP_FROM_NAME: 'Webitof CRM' });
  const smtp = mailer.resolveSmtpConfig('amc_reminder');
  assert.equal(smtp.source, 'default');
  assert.equal(smtp.fromEmail, 'contact@webitof.com');
  assert.equal(smtp.fromName, 'Webitof Billing');
});

test('nothing configured: no SMTP, and sendMail refuses with a clear message', async (t) => {
  withEnv(t, {});
  assert.equal(mailer.resolveSmtpConfig('invoice'), null);
  await assert.rejects(mailer.sendMail({ mailType: 'invoice', to: 'a@b.co', subject: 's', text: 't' }), /Billing mailbox/);
});

test('a login without a password or host does not count', (t) => {
  withEnv(t, { SMTP_HR_USER: 'hr@webitof.com', SMTP_HR_PASSWORD: 'x' });
  assert.equal(mailer.resolveSmtpConfig('hr'), null, 'no host');
  process.env.SMTP_HOST = 'smtp.hostinger.com';
  process.env.SMTP_HR_PASSWORD = '';
  assert.equal(mailer.resolveSmtpConfig('hr'), null, 'no password');
});

test('status lists all five mailboxes with their mail types and no password', (t) => {
  withEnv(t, { ...SHARED, SMTP_NOREPLY_USER: 'noreply@webitof.com', SMTP_NOREPLY_PASSWORD: 'secret-pass' });
  const status = mailer.getMailboxStatus();
  assert.equal(status.defaultAccount.configured, false);
  assert.equal(status.mailboxes.length, 5);
  const noreply = status.mailboxes.find((box) => box.key === 'noreply');
  assert.equal(noreply.source, 'own');
  assert.equal(noreply.address, 'noreply@webitof.com');
  assert.ok(noreply.mailTypes.some((type) => type.key === 'password_reset'));
  assert.equal(status.mailboxes.find((box) => box.key === 'billing').source, 'none');
  assert.ok(!JSON.stringify(status).includes('secret-pass'));
});

test('settings never return or keep an SMTP login', async (t) => {
  let row = { id: 'default', company: { name: 'Webitof' }, smtp: { host: 'h', username: 'u', password: 'p' }, payload: {} };
  let written = null;
  t.mock.method(settingsModel.settingsRepository, 'findById', async () => row);
  t.mock.method(settingsModel.settingsRepository, 'upsert', async (data) => {
    written = data;
    row = { ...row, ...data };
    return row;
  });
  const read = await settingsModel.getSettings();
  assert.equal(read.smtp, undefined);
  await settingsModel.updateSettings({ smtp: { host: 'evil', password: 'p2' }, company: { name: 'Webitof' } });
  assert.deepEqual(written.smtp, {});
});
