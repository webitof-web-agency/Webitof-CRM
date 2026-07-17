const { getSettings, updateSettings } = require('../models/settings.model');

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
    const { getSettings } = require('../models/settings.model');
    // We only unlink logos from settings now; we do not delete from Drive.

    const settings = await updateSettings(req.body || {});
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  fetchSettings,
  saveSettings
};
