// Upload folders under "Webitof ERP Data": 01 CRM/Leads/LD-2026-000017 - Vashi Tech, finance by
// FY/month, dated file names. No database: the record lookup and file_assets queries are stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-folders-test-'));
process.env.LOCAL_STORAGE_DIR = path.join(TMP, 'files');
process.env.STORAGE_PROVIDER = 'local';

const settingsStore = require('../models/systemSetting.model');
const { buildFolderPath, employeeFolder, displaySegment } = require('../utils/uploadPath');
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

// A fake db client for saveUpload: answers the "first folder of this record" and "name taken" checks.
function fakeDb({ recordFolder = '', taken = [] } = {}) {
  const takenSet = new Set(taken);
  return {
    query: async (sql, params) => {
      if (/select folder_key/.test(sql)) return { rows: recordFolder ? [{ folder_key: recordFolder }] : [], rowCount: recordFolder ? 1 : 0 };
      return { rows: [], rowCount: takenSet.has(`${params[0]}/${params[1]}`) ? 1 : 0 };
    }
  };
}

async function withCreateStub(run) {
  const created = [];
  const originalCreate = fileAssetModel.create;
  fileAssetModel.create = async (data) => {
    created.push(data);
    return { id: `file_${created.length}`, ...data };
  };
  try {
    return await run(created);
  } finally {
    fileAssetModel.create = originalCreate;
  }
}

test('a record with a number is "<number> - <name>"; without one "<name> (<last 4 of id>)"', () => {
  assert.equal(
    buildFolderPath({ moduleName: 'lead', entityId: 'lead_9f3a', entity: { number: 'LD-2026-000017', name: 'Vashi Tech' }, date: NOV }),
    '01 CRM/Leads/LD-2026-000017 - Vashi Tech'
  );
  assert.equal(
    buildFolderPath({ moduleName: 'project', entityId: 'proj_x8k2', entity: { name: 'Acme Website!' }, date: NOV }),
    '01 CRM/Projects/Acme Website (x8k2)'
  );
  assert.equal(buildFolderPath({ moduleName: 'clients', entityId: 'client_c91d', entityLabel: 'Kamla Horeca' }), '01 CRM/Clients/Kamla Horeca (c91d)');
});

test('a name with no usable characters falls back to the id folder; long names are cut', () => {
  assert.equal(buildFolderPath({ moduleName: 'projects', entityId: 'proj_x8k2', entity: { name: '★★★' }, date: NOV }), '01 CRM/Projects/proj_x8k2');
  const folder = buildFolderPath({ moduleName: 'clients', entityId: 'client_c91d', entity: { name: 'A'.repeat(120) }, date: NOV });
  assert.equal(folder, `01 CRM/Clients/${'A'.repeat(50)} (c91d)`);
});

test('no record: by year and month; company files go to 06 Company', () => {
  assert.equal(buildFolderPath({ moduleName: 'projects', date: NOV }), '01 CRM/Projects/2026/11-Nov');
  assert.equal(buildFolderPath({ moduleName: 'settings', entityId: 'company-profile', entityLabel: 'Webitof' }), '06 Company');
});

test('folder names keep spaces and brackets but nothing a file system or path would trip on', () => {
  assert.equal(displaySegment('Acme / Sons: "Best" <Co>?'), 'Acme Sons Best Co');
  assert.equal(displaySegment('  Ránjan & Co. (Pvt) Ltd.  '), 'Ranjan & Co. (Pvt) Ltd');
  assert.equal(displaySegment('...'), '');
});

test('record details come from fixed queries per section', async () => {
  const calls = [];
  labels.setLabelLookupForTests(async (section, id, sql) => {
    calls.push({ section, id, sql });
    if (section === 'clients') return { name: 'Kamla Horeca', date: '2026-04-02' };
    if (section === 'invoices') return { number: 'INV-2026-0012', name: 'Acme', date: '2026-11-03' };
    if (section === 'amc') return { name: 'Yearly AMC', client_id: 'client_c91d', client_name: 'Acme Pvt Ltd' };
    return null;
  });
  assert.deepEqual(await labels.resolveEntityInfo('clients', 'client_1'), { number: '', name: 'Kamla Horeca', date: '2026-04-02', clientId: '', clientName: '' });
  assert.equal((await labels.resolveEntityInfo('invoice', 'inv_1')).number, 'INV-2026-0012');
  assert.equal((await labels.resolveEntityInfo('amc', 'amc_1')).clientName, 'Acme Pvt Ltd');
  assert.equal(await labels.resolveEntityLabel('invoices', 'inv_1'), 'INV-2026-0012');
  assert.equal(await labels.resolveEntityInfo('lead-events', 'missing'), null);
  assert.equal(await labels.resolveEntityInfo('unknown-section', 'x'), null);
  assert.deepEqual(calls.map((call) => call.section), ['clients', 'invoices', 'amc', 'invoices', 'lead-events']);
  // The browser never picks the table: every query is a fixed string with the id as $1.
  assert.ok(calls.every((call) => call.sql.includes('$1') && call.id));
  assert.ok(Object.values(labels.SOURCES).every((sql) => /where \w+\.?\w* = \$1|where id = \$1/.test(sql)));
});

test('a failing lookup gives null instead of throwing', async () => {
  labels.setLabelLookupForTests(async () => {
    throw new Error('database down');
  });
  assert.equal(await labels.resolveEntityInfo('projects', 'proj_1'), null);
});

test('saveUpload files under the record folder with a dated, readable name', async () => {
  labels.setLabelLookupForTests(async () => ({ number: 'INV-2026-0012', name: 'Acme', date: '2026-11-03' }));
  await withCreateStub(async (created) => {
    await fileService.saveUpload({
      buffer: Buffer.from('%PDF-1.4'),
      originalName: 'Signed PO (final).pdf',
      moduleName: 'invoices',
      entityId: 'inv_x8k2',
      dbClient: fakeDb()
    });
    assert.equal(created[0].folderKey, '02 Finance/Invoices/FY 2026-27/11-Nov/INV-2026-0012 - Acme');
    assert.match(created[0].storedName, /^\d{4}-\d{2}-\d{2}_signed-po-final\.pdf$/);
    assert.equal(created[0].storageKey, `${created[0].folderKey}/${created[0].storedName}`);
  });
});

test('a record keeps the folder of its first upload after it is renamed', async () => {
  labels.setLabelLookupForTests(async () => ({ number: 'LD-2026-000017', name: 'Vashi Tech Renamed' }));
  await withCreateStub(async (created) => {
    await fileService.saveUpload({
      buffer: Buffer.from('%PDF-1.4'),
      originalName: 'brief.pdf',
      moduleName: 'leads',
      entityId: 'lead_1',
      dbClient: fakeDb({ recordFolder: '01 CRM/Leads/LD-2026-000017 - Vashi Tech' })
    });
    assert.equal(created[0].folderKey, '01 CRM/Leads/LD-2026-000017 - Vashi Tech');
  });
});

test('call recordings get the time in their name and go by year/month', async () => {
  labels.setLabelLookupForTests(async () => null);
  const name = fileService.datedFileBase('Call_+919876543210.mp3', 'calls', new Date('2026-11-27T05:02:00Z'));
  assert.equal(name, '2026-11-27_10-32_call-919876543210');
  assert.equal(fileService.datedFileBase('Brief.docx', 'leads', new Date('2026-11-27T05:02:00Z')), '2026-11-27_brief');
});

test('the same file name twice in one folder gets -2', async () => {
  labels.setLabelLookupForTests(async () => ({ name: 'Acme Website' }));
  await withCreateStub(async (created) => {
    const upload = (db) => fileService.saveUpload({
      buffer: Buffer.from('%PDF-1.4'), originalName: 'spec.pdf', moduleName: 'projects', entityId: 'proj_x8k2', dbClient: db
    });
    await upload(fakeDb());
    const first = created[0];
    await upload(fakeDb({ taken: [`${first.folderKey}/${first.storedName}`] }));
    assert.equal(created[1].storedName, first.storedName.replace('.pdf', '-2.pdf'));
  });
});

test('saveUpload still works in the id folder when the lookup fails', async () => {
  labels.setLabelLookupForTests(async () => {
    throw new Error('database down');
  });
  await withCreateStub(async () => {
    const saved = await fileService.saveUpload({ buffer: Buffer.from('%PDF-1.4'), originalName: 'a.pdf', moduleName: 'projects', entityId: 'proj_x8k2', dbClient: fakeDb() });
    assert.equal(saved.folderKey, '01 CRM/Projects/proj_x8k2');
  });
});

// Call recordings: one folder per number, each file "<number> - <name> - <date time> - <duration>".
const { callFolder, callFileBase, formatCallDuration, normalizeCallPhone } = require('../utils/uploadPath');

test('one phone number is one folder, however the app wrote it', () => {
  for (const phone of ['9876543210', '+91 98765 43210', '919876543210', '09876543210', '+91-98765-43210']) {
    assert.equal(normalizeCallPhone(phone), '+919876543210', phone);
  }
  assert.equal(normalizeCallPhone('+1 (415) 555-0100'), '+14155550100');
  assert.equal(callFolder({ phone: '98765 43210', name: 'Vashi Tech' }), '01 CRM/Calls/+919876543210 - Vashi Tech');
  // The app's placeholder names are not folder names.
  assert.equal(callFolder({ phone: '9876543210', name: 'Customer' }), '01 CRM/Calls/+919876543210');
  assert.equal(callFolder({ phone: '', name: '' }), '01 CRM/Calls/Unknown Number');
});

test('a recording is named number - name - date time (India) - duration', () => {
  const base = callFileBase({ phone: '9876543210', name: 'Vashi Tech', startedAt: '2026-11-27T05:02:00Z', durationSeconds: 205 });
  assert.equal(base, '+919876543210 - Vashi Tech - 2026-11-27 10-32 - 3m 25s');
  assert.equal(callFileBase({ phone: '9876543210', startedAt: '2026-11-27T05:02:00Z' }), '+919876543210 - 2026-11-27 10-32');
  assert.equal(formatCallDuration(45), '45s');
  assert.equal(formatCallDuration(3730), '1h 02m 10s');
  assert.equal(formatCallDuration(0), '');
});

test('a recording name is kept as given; a second one in the same minute gets " (2)"', async () => {
  const folder = '01 CRM/Calls/+919876543210 - Vashi Tech';
  const base = '+919876543210 - Vashi Tech - 2026-11-27 10-32 - 3m 25s';
  await withCreateStub(async (created) => {
    const upload = (db) => fileService.saveUpload({
      buffer: Buffer.from('ID3'), originalName: 'rec.mp3', moduleName: 'calls', entityId: 'call_1',
      types: fileService.AUDIO_TYPES, dbClient: db, folderPath: folder, fileBaseName: base, keepFileName: true
    });
    await upload(fakeDb());
    assert.equal(created[0].storedName, `${base}.mp3`);
    assert.equal(created[0].storageKey, `${folder}/${base}.mp3`);
    await upload(fakeDb({ taken: [`${folder}/${base}.mp3`] }));
    assert.equal(created[1].storedName, `${base} (2).mp3`);
  });
});

// HR documents: one folder per employee, files named <document>-<employee>.
test('an employee folder is "<employee number> - <name>/Documents"', () => {
  assert.equal(employeeFolder({ fullName: 'Mallika Paik', employeeNumber: 'EMP-12' }), '04 HRM/Employees/EMP-12 - Mallika Paik/Documents');
  assert.equal(employeeFolder({ fullName: '  Ravi  K. Sahu ', employeeNumber: 'EMP-3' }), '04 HRM/Employees/EMP-3 - Ravi K. Sahu/Documents');
  assert.equal(employeeFolder({ fullName: '★', employeeNumber: 'EMP-4' }), '04 HRM/Employees/EMP-4/Documents');
});

test('document names read <document>-<employee>', () => {
  assert.equal(fileService.slugFileBase('Aadhaar Card Mallika Paik'), 'aadhaar-card-mallika-paik');
  assert.equal(fileService.slugFileBase('Bank Proof (Cancelled Cheque / Passbook) Mallika Paik'), 'bank-proof-cancelled-cheque-passbook-mallika-paik');
  assert.equal(fileService.slugFileBase('Profile Photo Ánanya Rao'), 'profile-photo-ananya-rao');
});

test('saveUpload with a fixed folder and readable name never overwrites: -2, -3 follow', async () => {
  const folder = '04 HRM/Employees/EMP-12 - Mallika Paik/Documents';
  const db = fakeDb({ taken: [`${folder}/pan-card-mallika-paik.pdf`] });
  const originalCreate = fileAssetModel.create;
  fileAssetModel.create = async (data) => ({ id: `file_${data.storedName}`, ...data });
  const upload = (title) => fileService.saveUpload({
    buffer: Buffer.from('%PDF-1.4'),
    originalName: 'IMG_2031.pdf',
    moduleName: 'hrm',
    entityId: 'hrm_1',
    dbClient: db,
    folderPath: folder,
    fileBaseName: `${title} Mallika Paik`
  });
  try {
    const first = await upload('Aadhaar Card');
    assert.equal(first.folderKey, folder);
    assert.equal(first.storedName, 'aadhaar-card-mallika-paik.pdf');
    assert.equal(first.originalName, 'IMG_2031.pdf');
    // Same document again: the first file is on disk (EEXIST) though the fake DB does not know it.
    assert.equal((await upload('Aadhaar Card')).storedName, 'aadhaar-card-mallika-paik-2.pdf');
    // Name already recorded in the database for this folder.
    assert.equal((await upload('PAN Card')).storedName, 'pan-card-mallika-paik-2.pdf');
  } finally {
    fileAssetModel.create = originalCreate;
  }
});
