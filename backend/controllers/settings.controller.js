const { getSettings, updateSettings } = require('../models/settings.model');
const { hasPermission } = require('../middlewares/auth');

// SMTP credentials are only returned to users who can edit settings; everyone else reads settings for labels/statuses.
function redactSecrets(settings, user) {
  if (!settings || hasPermission(user, 'settings.write')) return settings;
  const { smtp, ...rest } = settings;
  if (!smtp) return rest;
  const { password, ...publicSmtp } = smtp;
  return { ...rest, smtp: publicSmtp };
}

async function fetchSettings(req, res, next) {
  try {
    const settings = await getSettings();
    res.json({ success: true, data: redactSecrets(settings, req.user) });
  } catch (error) {
    next(error);
  }
}

async function saveSettings(req, res, next) {
  try {
    const { getSettings } = require('../models/settings.model');
    // We only unlink logos from settings now; we do not delete from Drive.

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
      logos: settings?.logos || {},
      branding: settings?.branding || {},
      ui: settings?.ui || {}
    };
    res.json({ success: true, data: publicData });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  fetchSettings,
  fetchPublicSettings,
  saveSettings
};
