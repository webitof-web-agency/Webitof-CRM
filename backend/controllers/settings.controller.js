const { getSettings, updateSettings } = require('../models/settings.model');
const { getMailboxStatus, sendTestMail } = require('../services/mailer.service');

// SMTP logins are env-only (config/mailSenders.js), so settings no longer hold any mail secret.
async function fetchSettings(req, res, next) {
  try {
    const settings = await getSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
}

async function saveSettings(req, res, next) {
  try {
    const settings = await updateSettings(req.body || {});
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
}

async function fetchPublicSettings(req, res, next) {
  try {
    const settings = await getSettings();
    const publicData = {
      companyName: settings?.company?.name || 'Webitof',
      legalName: settings?.company?.legalName || '',
      logoUrl: settings?.company?.logoUrl || '',
      branding: settings?.branding || {},
      ui: settings?.ui || {}
    };
    res.json({ success: true, data: publicData });
  } catch (error) {
    next(error);
  }
}

// Read-only: the five mailboxes, where each login comes from and which mails it sends.
async function fetchEmailStatus(req, res, next) {
  try {
    res.json({ success: true, data: getMailboxStatus() });
  } catch (error) {
    next(error);
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendEmailTest(req, res) {
  const mailbox = String(req.body?.mailbox || '').trim();
  const to = String(req.body?.to || req.user?.email || '').trim();
  if (!EMAIL_PATTERN.test(to)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address to send the test to.' });
  }
  try {
    const data = await sendTestMail({ mailbox, to });
    return res.json({ success: true, message: `Test mail sent to ${to}`, data });
  } catch (error) {
    // SMTP errors (wrong password, blocked port) are shown to the admin as they are.
    return res.status(error.statusCode || 502).json({ success: false, message: error.message || 'Test mail failed' });
  }
}

module.exports = {
  fetchEmailStatus,
  fetchSettings,
  fetchPublicSettings,
  saveSettings,
  sendEmailTest
};
