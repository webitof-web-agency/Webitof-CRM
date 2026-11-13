const { createRepository, column } = require('./baseModel');
const { customOnly, pipelineSettings } = require('../config/pipelineFields');

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

// Never stored:
// - logos: static files in the frontend (src/config/brandAssets.js);
// - customSources: derived on read (which lead sources an admin added).
// Values older versions saved in the payload column are hidden on read and dropped on save.
const STATIC_KEYS = ['logos', 'customSources'];

// statuses / sources: the built-in lists live in config/pipelineFields.js. Only the values an
// admin added are stored; reads return built-in + custom, saves keep the custom part only.
const PIPELINE_KEYS = ['statuses', 'sources'];

function withoutStaticKeys(record) {
  if (!record) return record;
  const clean = { ...record };
  for (const key of STATIC_KEYS) delete clean[key];
  if (clean.payload && typeof clean.payload === 'object') {
    clean.payload = { ...clean.payload };
    for (const key of [...STATIC_KEYS, ...PIPELINE_KEYS]) delete clean.payload[key];
  }
  return clean;
}

function withStaticValues(record) {
  if (!record) return record;
  return { ...withoutStaticKeys(record), ...pipelineSettings({ statuses: record.statuses, sources: record.sources }) };
}

// Pass the open transaction client when calling from inside withTransaction: a pool read there
// needs a second connection while the first holds locks.
async function getSettings(db = null) {
  const record = await settingsRepository.findById('default', db);
  return withStaticValues(record) || null;
}

async function updateSettings(patch = {}) {
  const current = (await getSettings()) || { id: 'default' };
  const incoming = { ...(patch || {}) };
  for (const key of STATIC_KEYS) delete incoming[key];
  const next = withoutStaticKeys(mergeDeep(current, incoming));
  // update() spreads the stored row under this patch, so payload-only keys must be overwritten:
  // undefined is dropped from the JSON payload.
  for (const key of STATIC_KEYS) next[key] = undefined;
  Object.assign(next, customOnly({ statuses: next.statuses, sources: next.sources }));
  next.id = 'default';
  const saved = await settingsRepository.upsert(next);
  return withStaticValues(saved);
}

module.exports = {
  getSettings,
  settingsRepository,
  updateSettings
};
