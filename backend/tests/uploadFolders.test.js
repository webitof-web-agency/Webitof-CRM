// Readable Drive upload folders: <year>/<mon>/<section>/<Name>-<shortId>. No database: the label lookup is stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-folders-test-'));
process.env.LOCAL_STORAGE_DIR = path.join(TMP, 'files');
process.env.STORAGE_PROVIDER = 'local';

const settingsStore = require('../models/systemSetting.model');
const { buildFolderPath } = require('../utils/uploadPath');
const labels = require('../services/storage/entityLabel.service');
const fileService = require('../services/file.service');
const fileAssetModel = require('../models/fileAsset.model');

const NOV = new Date('2026-11-09T06:00:00Z');

settingsStore.setStoreForTests(settingsStore.createMemoryStore());
test.after(() => {
  labels.setLabelLookupForTests(null);
  settingsStore.setStoreForTests(null);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('a record label becomes <Name>-<last 4 of id> under year/month/section', () => {
  assert.equal(
    buildFolderPath({ moduleName: 'project', entityId: 'proj_x8k2', entityLabel: 'Acme Website!', date: NOV }),
    '2026/nov/projects/Acme-Website-x8k2'
  );
});

test('a label with no usable characters falls back to the id folder', () => {
  assert.equal(
    buildFolderPath({ moduleName: 'projects', entityId: 'proj_x8k2', entityLabel: '★★★', date: NOV }),
    '2026/nov/projects/proj_x8k2'
  );
});

test('long labels are cut to 50 characters before the short id', () => {
  const folder = buildFolderPath({ moduleName: 'clients', entityId: 'client_c91d', entityLabel: 'A'.repeat(120), date: NOV });
  assert.equal(folder, `2026/nov/clients/${'A'.repeat(50)}-c91d`);
});

test('no label keeps the id folder and site uploads still go to site/', () => {
  assert.equal(buildFolderPath({ moduleName: 'projects', entityId: 'proj_x8k2', date: NOV }), '2026/nov/projects/proj_x8k2');
  assert.equal(buildFolderPath({ moduleName: 'settings', entityId: 'company-profile', entityLabel: 'Webitof' }), 'site');
});

test('labels come from fixed tables and columns per section', async () => {
  const calls = [];
  labels.setLabelLookupForTests(async (table, columns, id) => {
    calls.push({ table, columns, id });
    if (table === 'clients') return { company_name: '', name: 'Kamla Horeca' };
    if (table === 'expenses') return { vendor: 'Hostinger', invoice_number: 'INV-221' };
    if (table === 'projects') return { title: 'Acme Website' };
    return null;
  });
  assert.equal(await labels.resolveEntityLabel('clients', 'client_1'), 'Kamla Horeca');
  assert.equal(await labels.resolveEntityLabel('expenses', 'exp_1'), 'Hostinger INV-221');
  assert.equal(await labels.resolveEntityLabel('project', 'proj_1'), 'Acme Website');
  assert.equal(await labels.resolveEntityLabel('lead-events', 'missing'), null);
  assert.equal(await labels.resolveEntityLabel('unknown-section', 'x'), null);
  assert.deepEqual(calls.map((call) => call.table), ['clients', 'expenses', 'projects', 'lead_events']);
});

test('a failing lookup gives null instead of throwing', async () => {
  labels.setLabelLookupForTests(async () => {
    throw new Error('database down');
  });
  assert.equal(await labels.resolveEntityLabel('projects', 'proj_1'), null);
});

test('saveUpload files the upload under the readable record folder', async () => {
  labels.setLabelLookupForTests(async () => ({ title: 'Acme Website' }));
  const created = [];
  const originalCreate = fileAssetModel.create;
  fileAssetModel.create = async (data) => {
    created.push(data);
    return { id: 'file_t1', ...data };
  };
  try {
    await fileService.saveUpload({ buffer: Buffer.from('%PDF-1.4'), originalName: 'spec.pdf', moduleName: 'projects', entityId: 'proj_x8k2' });
    assert.match(created[0].folderKey, /^\d{4}\/[a-z]{3}\/projects\/Acme-Website-x8k2$/);
    assert.ok(created[0].storageKey.startsWith(`${created[0].folderKey}/spec-`));
  } finally {
    fileAssetModel.create = originalCreate;
  }
});

test('saveUpload still works in the id folder when the lookup fails', async () => {
  labels.setLabelLookupForTests(async () => {
    throw new Error('database down');
  });
  const originalCreate = fileAssetModel.create;
  fileAssetModel.create = async (data) => ({ id: 'file_t2', ...data });
  try {
    const saved = await fileService.saveUpload({ buffer: Buffer.from('%PDF-1.4'), originalName: 'a.pdf', moduleName: 'projects', entityId: 'proj_x8k2' });
    assert.match(saved.folderKey, /\/projects\/proj_x8k2$/);
  } finally {
    fileAssetModel.create = originalCreate;
  }
});
