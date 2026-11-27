// Files page: virtual folders over file_assets. The current layout's top folders are always listed
// (first, in order); folders of earlier layouts come after, flagged legacy. No database: the file
// list is stubbed and the user is a Super Admin (no lead pipeline lookup).
const test = require('node:test');
const assert = require('node:assert/strict');

const fileAssetModel = require('../models/fileAsset.model');
const controller = require('../controllers/files.controller');

const ADMIN = { id: 'u1', isSuperAdmin: true, permissions: [] };
const ROWS = [
  { id: 'f1', moduleName: 'leads', entityId: 'lead_1', folderKey: '01 CRM/Leads/LD-2026-000017 - Vashi Tech', originalName: 'brief.pdf' },
  { id: 'f2', moduleName: 'leads', entityId: 'lead_1', folderKey: '01 CRM/Leads/LD-2026-000017 - Vashi Tech', originalName: 'quote.pdf' },
  { id: 'f3', moduleName: 'invoices', entityId: 'inv_1', folderKey: '02 Finance/Invoices/FY 2026-27/11-Nov/INV-2026-0012 - Acme', originalName: 'po.pdf' },
  { id: 'f4', moduleName: 'projects', entityId: 'p1', folderKey: 'CRM/Projects/Acme-Website-x8k2', originalName: 'old.pdf' },
  { id: 'f5', moduleName: 'general', folderKey: '', originalName: 'very-old.pdf' },
  { id: 'f6', moduleName: 'general', folderKey: '07 General/Files/2026/11-Nov', originalName: 'gone.pdf', isArchived: true }
];

function call(handler, query = {}) {
  return new Promise((resolve, reject) => {
    const res = { json: (body) => resolve(body), status() { return this; } };
    handler({ query, user: ADMIN }, res, reject);
  });
}

test('the tree nests every folder with file counts; empty top folders are there, older layouts last', async (t) => {
  t.mock.method(fileAssetModel, 'list', async () => ROWS);
  const { data } = await call(controller.tree);
  assert.equal(data.fileCount, 5, 'archived files are left out');
  assert.deepEqual(
    data.folders.map((folder) => [folder.name, folder.fileCount, Boolean(folder.legacy)]),
    [
      ['01 CRM', 2, false], ['02 Finance', 1, false], ['03 Services', 0, false], ['04 HRM', 0, false],
      ['05 Users', 0, false], ['06 Company', 0, false], ['07 General', 0, false],
      ['CRM', 1, true], ['earlier-uploads', 1, true]
    ]
  );
  const invoices = data.folders[1].children[0];
  assert.equal(invoices.path, '02 Finance/Invoices');
  assert.equal(invoices.children[0].children[0].children[0].path, '02 Finance/Invoices/FY 2026-27/11-Nov/INV-2026-0012 - Acme');
});

test('browsing the root lists the same top folders; a folder lists its subfolders and files', async (t) => {
  t.mock.method(fileAssetModel, 'list', async () => ROWS);
  const root = (await call(controller.browse, { path: '' })).data;
  assert.deepEqual(root.folders.map((folder) => folder.name).slice(0, 7), ['01 CRM', '02 Finance', '03 Services', '04 HRM', '05 Users', '06 Company', '07 General']);
  assert.equal(root.folders.find((folder) => folder.name === 'CRM').legacy, true);
  assert.equal(root.files.length, 0);

  const record = (await call(controller.browse, { path: '01 CRM/Leads/LD-2026-000017 - Vashi Tech' })).data;
  assert.deepEqual(record.files.map((file) => file.originalName).sort(), ['brief.pdf', 'quote.pdf']);
  assert.deepEqual((await call(controller.browse, { path: '01 CRM' })).data.folders.map((folder) => [folder.name, folder.fileCount]), [['Leads', 2]]);
});
