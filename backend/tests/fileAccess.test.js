// Who may open a stored file through the session-less view routes and the signed-in link lookup.
// Runs without a database: the file service, settings and lead lookups are stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('stream');

const fileService = require('../services/file.service');
const settingsModel = require('../models/settings.model');
const leadModel = require('../models/lead.model');
const controller = require('../controllers/files.controller');

const FILES = {
  file_private1: { id: 'file_private1', driveFileId: 'drivePrivate1', moduleName: 'leads', entityId: 'lead_1', mimeType: 'image/png', originalName: 'quote.png' },
  file_avatar1: { id: 'file_avatar1', driveFileId: 'driveAvatar1', moduleName: 'users', entityId: 'user_1', mimeType: 'image/png', originalName: 'me.png' },
  file_logo1: { id: 'file_logo1', driveFileId: 'driveLogo1', moduleName: 'general', entityId: '', mimeType: 'image/png', originalName: 'logo.png' },
  file_flagged1: { id: 'file_flagged1', driveFileId: 'driveFlagged1', moduleName: 'general', entityId: '', isPublic: true, mimeType: 'image/png', originalName: 'x.png' }
};

let settings = {};
let leadPipeline = 'default';
let leadAssignee = 'someone-else';

fileService.findByRef = async (ref) => FILES[ref] || Object.values(FILES).find((file) => file.driveFileId === ref) || null;
fileService.openFile = async () => {
  const stream = new PassThrough();
  stream.end('data');
  return { status: 200, stream, contentLength: 4 };
};
settingsModel.getSettings = async () => settings;
leadModel.findById = async (id) => ({ id, pipelineId: leadPipeline, assignedTo: leadAssignee });

function fakeRes() {
  const res = new PassThrough();
  res.statusCode = 200;
  res.status = (code) => { res.statusCode = code; return res; };
  res.type = () => res;
  res.send = (body) => { res.body = body; res.end(); return res; };
  res.json = (body) => { res.body = body; res.end(); return res; };
  res.writeHead = (code) => { res.statusCode = code; res.headersSent = true; };
  return res;
}

async function view(handler, params) {
  const res = fakeRes();
  await handler({ params, query: {}, headers: {} }, res);
  return res.statusCode;
}

async function link(id, user) {
  const res = fakeRes();
  let error = null;
  await controller.getLink({ params: { id }, user }, res, (err) => { error = err; });
  return { status: error ? error.statusCode || 500 : res.statusCode, body: res.body };
}

test('a random file id opens the file without a session', async () => {
  assert.equal(await view(controller.viewFile, { id: 'file_private1' }), 200);
});

test('a Drive id does not open a private file on either view route', async () => {
  settings = {};
  assert.equal(await view(controller.viewFile, { id: 'drivePrivate1' }), 403);
  assert.equal(await view(controller.viewLegacyDriveFile, { driveFileId: 'drivePrivate1' }), 403);
});

test('a Drive id still opens public assets', async () => {
  settings = { logos: { primary: 'https://drive.google.com/uc?id=driveLogo1' } };
  assert.equal(await view(controller.viewLegacyDriveFile, { driveFileId: 'driveAvatar1' }), 200);
  assert.equal(await view(controller.viewLegacyDriveFile, { driveFileId: 'driveLogo1' }), 200);
  assert.equal(await view(controller.viewLegacyDriveFile, { driveFileId: 'driveFlagged1' }), 200);
  settings = {};
  assert.equal(await view(controller.viewLegacyDriveFile, { driveFileId: 'driveLogo1' }), 403);
});

test('an unknown reference is not found', async () => {
  assert.equal(await view(controller.viewLegacyDriveFile, { driveFileId: 'nope' }), 404);
});

test('the link lookup turns a Drive id into the file-id view link for permitted users', async () => {
  leadPipeline = 'default';
  const filesReader = { id: 'u1', permissions: ['files.read', 'leads.view_all'] };
  const leadsReader = { id: 'u2', permissions: ['leads.read', 'leads.view_all'] };
  for (const user of [filesReader, leadsReader]) {
    const result = await link('drivePrivate1', user);
    assert.equal(result.status, 200);
    assert.equal(result.body.data.viewUrl, '/files/file_private1/view');
  }
});

test('the link lookup refuses users without files.read or the module read permission', async () => {
  const result = await link('drivePrivate1', { id: 'u3', permissions: ['clients.read'] });
  assert.equal(result.status, 403);
});

test('the link lookup refuses lead files from pipelines the user cannot open', async () => {
  leadPipeline = 'enterprise';
  const user = { id: 'u4', permissions: ['leads.read'], payload: { allowedLeadPipelineIds: ['default'] } };
  const result = await link('drivePrivate1', user);
  assert.equal(result.status, 403);
  leadPipeline = 'default';
});

test('without leads.view_all a lead file opens only for users working on that lead', async () => {
  const user = { id: 'u5', permissions: ['leads.read'] };
  leadAssignee = 'someone-else';
  assert.equal((await link('drivePrivate1', user)).status, 403);
  leadAssignee = 'u5';
  assert.equal((await link('drivePrivate1', user)).status, 200);
  leadAssignee = 'someone-else';
});

async function removeFile(id, user) {
  const res = fakeRes();
  let error = null;
  const removed = [];
  const original = fileService.removeFile;
  fileService.removeFile = async (file) => { removed.push(file.id); };
  try {
    await controller.remove({ params: { id }, user }, res, (err) => { error = err; });
  } finally {
    fileService.removeFile = original;
  }
  return { status: error ? error.statusCode || 500 : res.statusCode, removed };
}

test('files.write alone cannot delete a general file; files.delete can', async () => {
  assert.equal((await removeFile('file_logo1', { id: 'u6', permissions: ['files.write'] })).status, 403);
  const allowed = await removeFile('file_logo1', { id: 'u6', permissions: ['files.delete'] });
  assert.equal(allowed.status, 200);
  assert.deepEqual(allowed.removed, ['file_logo1']);
});

test('a lead attachment can be removed by someone who can edit that lead', async () => {
  leadAssignee = 'u7';
  const editor = { id: 'u7', permissions: ['files.write', 'leads.read', 'leads.write'] };
  assert.equal((await removeFile('file_private1', editor)).status, 200);
  leadAssignee = 'someone-else';
  assert.equal((await removeFile('file_private1', editor)).status, 403);
});
