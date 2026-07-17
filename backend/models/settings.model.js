const { createRepository, column } = require('./baseModel');

const settingsRepository = createRepository({
  table: 'app_settings',
  idPrefix: 'settings',
  columns: [
    column({ key: 'company', db: 'company', type: 'json' }),
    column({ key: 'gst', db: 'gst', type: 'json' }),
    column({ key: 'tds', db: 'tds', type: 'json' }),
    column({ key: 'invoice', db: 'invoice', type: 'json' }),
    column({ key: 'bank', db: 'bank', type: 'json' }),
    column({ key: 'branding', db: 'branding', type: 'json' }),
    column({ key: 'smtp', db: 'smtp', type: 'json' }),
    column({ key: 'emailTemplates', db: 'email_templates', type: 'json' }),
    column({ key: 'complianceNote', db: 'compliance_note', type: 'string' }),
    column({ key: 'roles', db: 'roles', type: 'json' }),
    column({ key: 'statuses', db: 'statuses', type: 'json' }),
    column({ key: 'sources', db: 'sources', type: 'json' }),
    column({ key: 'labels', db: 'labels', type: 'json' })
  ]
});

function mergeDeep(target = {}, source = {}) {
  const result = { ...target };
  Object.entries(source || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeDeep(target[key] || {}, value);
    } else {
      result[key] = value;
    }
  });
  return result;
}

async function getSettings() {
  const record = await settingsRepository.findById('default');
  return record || null;
}

async function updateSettings(patch = {}) {
  const current = (await getSettings()) || { id: 'default' };
  const next = mergeDeep(current, patch);
  next.id = 'default';
  const saved = await settingsRepository.upsert(next);
  return saved;
}

module.exports = {
  getSettings,
  settingsRepository,
  updateSettings
};
