const fs = require('fs');
const { Readable } = require('stream');
const asyncHandler = require('../middlewares/asyncHandler');
const { getGoogleDriveConfig, refreshDriveSettings } = require('../config/googleDrive');
const driveSettings = require('../services/googleDrive/driveSettings.service');
const connection = require('../services/googleDrive/driveConnection.service');
const backups = require('../services/googleDrive/backup.service');
const storage = require('../services/storage/storage.service');

function settingsRedirect(params) {
  const base = getGoogleDriveConfig().frontendUrl;
  const query = new URLSearchParams({ tab: 'storage', ...params }).toString();
  return `${base}/#/settings?${query}`;
}

const status = asyncHandler(async (req, res) => {
  await refreshDriveSettings();
  const [drive, backup, storageSettings] = await Promise.all([
    connection.getStatus(),
    backups.getBackupStatus(),
    storage.getStorageSettings()
  ]);
  res.json({
    success: true,
    data: {
      drive,
      backup,
      storage: {
        activeProvider: storageSettings.activeProvider,
        usedForUploads: storageSettings.activeProvider === 'gdrive'
      }
    }
  });
});

const connect = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { url: await connection.getAuthUrl(req.user.id) } });
});

// Public: Google redirects the browser here. The signed state proves an admin started it.
async function oauthCallback(req, res) {
  try {
    await connection.completeOAuth({
      code: req.query.code,
      state: req.query.state,
      error: req.query.error
    });
    res.redirect(settingsRedirect({ gdrive: 'connected' }));
  } catch (error) {
    const message = error.expose ? error.message : 'Google Drive could not be connected.';
    if (!error.expose) console.error('Google Drive connect failed:', error);
    res.redirect(settingsRedirect({ gdrive: 'error', message: message.slice(0, 300) }));
  }
}

const disconnect = asyncHandler(async (req, res) => {
  await connection.disconnect({ activeProvider: await storage.getActiveProviderName() });
  res.json({ success: true, data: await connection.getStatus() });
});

const listBackups = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await backups.listBackups() });
});

const runBackupNow = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Manual Drive backups are disabled in production; the daily schedule handles them.'
    });
  }
  if (!(await connection.isConnected())) {
    return res.status(409).json({ success: false, message: 'Connect Google Drive first.' });
  }
  const started = backups.startBackupInBackground({ trigger: 'manual', userId: req.user?.id || null });
  res.status(202).json({
    success: true,
    message: started ? 'Backup started' : 'A backup is already running',
    data: await backups.getBackupStatus()
  });
});

const downloadBackup = asyncHandler(async (req, res) => {
  const { file, response } = await backups.openBackup(req.params.fileId);
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${file.name}"`,
    'Cache-Control': 'no-store',
    ...(file.size ? { 'Content-Length': String(file.size) } : {})
  });
  Readable.fromWeb(response.body).pipe(res);
});

// A fresh dump straight to the browser; nothing goes to Drive.
const downloadLocalBackup = asyncHandler(async (req, res) => {
  const dump = await backups.makeDump().catch((error) => {
    error.statusCode = 500;
    error.expose = true;
    throw error;
  });
  res.on('close', () => {
    void dump.cleanup();
  });
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${dump.fileName}"`,
    'Content-Length': String(dump.size),
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(dump.filePath).pipe(res);
});

const getConfig = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await driveSettings.getConfigView() });
});

const saveConfig = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await driveSettings.saveConfig(req.body || {}) });
});

module.exports = {
  connect,
  getConfig,
  saveConfig,
  disconnect,
  downloadBackup,
  downloadLocalBackup,
  listBackups,
  oauthCallback,
  runBackupNow,
  status
};
