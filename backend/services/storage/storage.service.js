// Picks the provider for new uploads. Existing files are always read through the
// provider recorded on their own row, so switching never breaks old files.
const { getSetting, setSetting } = require('../../models/systemSetting.model');
const { localProvider } = require('./providers/local.provider');
const { gdriveProvider } = require('./providers/gdrive.provider');
const connection = require('../googleDrive/driveConnection.service');

const SETTINGS_KEY = 'storage_settings';
const PROVIDERS = { local: localProvider, gdrive: gdriveProvider };

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

function envProvider() {
  const value = String(process.env.STORAGE_PROVIDER || '').trim().toLowerCase();
  return PROVIDERS[value] ? value : 'local';
}

async function getStorageSettings() {
  const saved = await getSetting(SETTINGS_KEY, {});
  const fromSite = saved.configurationSource === 'site_settings' && PROVIDERS[saved.activeProvider];
  return {
    configurationSource: fromSite ? 'site_settings' : 'environment',
    activeProvider: fromSite ? saved.activeProvider : envProvider(),
    availableProviders: Object.keys(PROVIDERS)
  };
}

async function getActiveProviderName() {
  return (await getStorageSettings()).activeProvider;
}

async function setActiveProvider(name) {
  if (!PROVIDERS[name]) throw httpError(`Unknown storage provider: ${name}`, 400);
  if (name === 'gdrive' && !(await connection.isConnected())) {
    throw httpError('Connect Google Drive before using it for uploads.', 409);
  }
  await setSetting(SETTINGS_KEY, { configurationSource: 'site_settings', activeProvider: name });
  return getStorageSettings();
}

function providerFor(locator) {
  const provider = PROVIDERS[locator?.storageProvider];
  if (!provider) throw new Error(`Unknown storage provider on file: ${locator?.storageProvider}`);
  return provider;
}

async function upload(buffer, storageKey, { mimeType } = {}) {
  const name = await getActiveProviderName();
  return PROVIDERS[name].upload(buffer, storageKey, { mimeType });
}

async function testProvider(name) {
  const provider = PROVIDERS[name || await getActiveProviderName()];
  if (!provider) throw httpError(`Unknown storage provider: ${name}`, 400);
  return provider.testConnection();
}

module.exports = {
  PROVIDERS,
  getActiveProviderName,
  getStorageSettings,
  open: (locator, options) => providerFor(locator).open(locator, options),
  readBuffer: (locator) => providerFor(locator).readBuffer(locator),
  exists: (locator) => providerFor(locator).exists(locator),
  remove: (locator) => providerFor(locator).delete(locator),
  rename: (locator, name) => providerFor(locator).rename(locator, name),
  setActiveProvider,
  testProvider,
  upload
};
