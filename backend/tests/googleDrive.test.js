// Google Drive storage + backups. Runs without a database or network:
// fetch is a fake Google, settings live in memory, pg_dump and the lock are stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const jwt = require('jsonwebtoken');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-drive-test-'));
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SETTINGS_ENCRYPTION_KEY = 'a'.repeat(64);
process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id';
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret';
process.env.FRONTEND_URL = 'https://crm.example.com';
process.env.DATABASE_URL = 'postgresql://crm_user:s3cret-pass@db.example.com:5432/crm';
process.env.LOCAL_STORAGE_DIR = path.join(TMP, 'files');

const { createFakeGoogleDrive } = require('./helpers/fakeGoogleDrive');
const settingsStore = require('../models/systemSetting.model');
const driveClient = require('../services/googleDrive/drive.client');
const connection = require('../services/googleDrive/driveConnection.service');
const backups = require('../services/googleDrive/backup.service');
const storage = require('../services/storage/storage.service');
const { gdriveProvider, clearFolderCache } = require('../services/storage/providers/gdrive.provider');
const { localProvider, parseRange } = require('../services/storage/providers/local.provider');
const { _resetDriveSettingsForTests, getGoogleDriveConfig, getGoogleDriveConfigProblems, parseFolderId } = require('../config/googleDrive');
const driveSettings = require('../services/googleDrive/driveSettings.service');
const { buildFolderPath } = require('../utils/uploadPath');
const googleDriveController = require('../controllers/googleDrive.controller');
const fileService = require('../services/file.service');
const fileAssetModel = require('../models/fileAsset.model');
const { requireAuth } = require('../middlewares/auth');

// Loading config/db pulls in backend/.env; drop anything from it that would reach real Google.
for (const name of [
  'GOOGLE_DRIVE_CLIENT_ID',
  'GOOGLE_DRIVE_CLIENT_SECRET',
  'GOOGLE_DRIVE_REFRESH_TOKEN',
  'GOOGLE_OAUTH_REFRESH_TOKEN',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'GDRIVE_PARENT_FOLDER_ID',
  'GDRIVE_BACKUP_HOUR_IST',
  'GDRIVE_BACKUP_KEEP',
  'GDRIVE_BACKUP_FOLDER_NAME',
  'GDRIVE_UPLOADS_FOLDER_NAME',
  'BACKUP_DATABASE_URL',
  'STORAGE_PROVIDER',
  'PG_DUMP_PATH'
]) {
  delete process.env[name];
}

let fake;
let memory;
let driveFileCount;

function setup(options) {
  fake = createFakeGoogleDrive(options);
  driveClient.setFetchForTests(fake.fetchImpl);
  memory = settingsStore.createMemoryStore();
  settingsStore.setStoreForTests(memory);
  _resetDriveSettingsForTests();
  driveFileCount = 0;
  connection.setDriveFileCounterForTests(async () => driveFileCount);
  connection._resetForTests();
  clearFolderCache();
  backups.setLockForTests(async () => async () => {});
  backups.setDumpRunnerForTests(async (filePath) => {
    fs.writeFileSync(filePath, Buffer.from('PGDMP fake dump'));
  });
}

async function connect() {
  return connection.saveConnection('refresh-1', { userId: 'user_admin' });
}

function mockRes() {
  return {
    redirectedTo: '',
    redirect(url) {
      this.redirectedTo = url;
    }
  };
}

test.after(() => {
  driveClient.setFetchForTests(null);
  settingsStore.setStoreForTests(null);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('config problems are listed by name and connect is refused', async () => {
  setup();
  const saved = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  try {
    const problems = getGoogleDriveConfigProblems();
    assert.deepEqual(problems, ['Client secret is not set (Settings or GOOGLE_OAUTH_CLIENT_SECRET)']);
    await assert.rejects(() => connection.getAuthUrl('user_admin'), { statusCode: 400 });
  } finally {
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = saved;
  }
});

test('auth URL asks for drive.file, offline access and consent, with a signed state', async () => {
  setup();
  const url = new URL(await connection.getAuthUrl('user_admin'));
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/drive.file');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  const state = jwt.verify(url.searchParams.get('state'), process.env.JWT_SECRET);
  assert.equal(state.purpose, 'gdrive-connect');
  assert.equal(state.uid, 'user_admin');
});

test('callback rejects a bad state, a denial and a bad code, always redirecting back', async () => {
  setup();
  const goodState = new URL(await connection.getAuthUrl('user_admin')).searchParams.get('state');
  const expired = jwt.sign({ purpose: 'gdrive-connect', uid: 'u', exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET);
  const wrongPurpose = jwt.sign({ purpose: 'other', uid: 'u' }, process.env.JWT_SECRET);

  for (const query of [
    { code: 'good-code', state: 'garbage' },
    { code: 'good-code', state: expired },
    { code: 'good-code', state: wrongPurpose },
    { error: 'access_denied', state: goodState },
    { code: 'bad-code', state: goodState }
  ]) {
    const res = mockRes();
    await googleDriveController.oauthCallback({ query }, res);
    const redirect = new URL(res.redirectedTo.replace('/#/', '/'));
    assert.equal(redirect.origin, 'https://crm.example.com');
    assert.equal(redirect.searchParams.get('gdrive'), 'error');
    assert.ok(redirect.searchParams.get('message').length <= 300);
  }
  assert.equal((await connection.getStatus()).connected, false);
});

test('callback fails clearly when Google sends no refresh token', async () => {
  setup();
  fake.state.returnRefreshToken = false;
  const state = new URL(await connection.getAuthUrl('user_admin')).searchParams.get('state');
  const res = mockRes();
  await googleDriveController.oauthCallback({ query: { code: 'good-code', state } }, res);
  const message = new URLSearchParams(res.redirectedTo.split('?')[1]).get('message');
  assert.match(message, /did not return a refresh token/);
});

test('a successful connect stores the token encrypted, creates both folders, and status has no secrets', async () => {
  setup();
  const state = new URL(await connection.getAuthUrl('user_admin')).searchParams.get('state');
  const res = mockRes();
  await googleDriveController.oauthCallback({ query: { code: 'good-code', state } }, res);
  assert.equal(res.redirectedTo, 'https://crm.example.com/#/settings?tab=storage&gdrive=connected');

  const raw = JSON.stringify(Object.fromEntries(memory.data));
  assert.ok(!raw.includes('refresh-1'), 'refresh token must not be stored in plain text');
  assert.ok(fake.findByName('Webitof CRM – DB Backups'));
  assert.ok(fake.findByName('Webitof CRM – Uploads'));

  const status = await connection.getStatus();
  assert.equal(status.connected, true);
  assert.equal(status.accountEmail, 'owner@example.com');
  assert.match(status.backupFolder.link, /^https:\/\/drive\.google\.com\/drive\/folders\//);
  const serialized = JSON.stringify(status);
  assert.ok(!serialized.includes('refresh-1') && !serialized.includes('ciphertext'));
});

test('invalid_grant marks the connection as needing a reconnect', async () => {
  setup();
  await connect();
  connection._resetForTests();
  fake.state.validRefreshTokens.clear();
  const client = await connection.getClient();
  await assert.rejects(() => client.about(), { reason: 'invalid_grant' });
  assert.equal((await connection.getStatus()).needsReconnect, true);
  await assert.rejects(() => connection.getClient(), { statusCode: 409 });
});

test('an undecryptable token asks for a reconnect instead of failing with a 500', async () => {
  setup();
  await connect();
  connection._resetForTests();
  const saved = process.env.SETTINGS_ENCRYPTION_KEY;
  process.env.SETTINGS_ENCRYPTION_KEY = 'b'.repeat(64);
  try {
    await assert.rejects(() => connection.getClient(), { statusCode: 409, message: /could not be decrypted/ });
  } finally {
    process.env.SETTINGS_ENCRYPTION_KEY = saved;
  }
});

test('disconnect is refused while Drive is the active provider or holds files', async () => {
  setup();
  await connect();
  await assert.rejects(() => connection.disconnect({ activeProvider: 'gdrive' }), { statusCode: 409 });
  driveFileCount = 3;
  await assert.rejects(() => connection.disconnect({ activeProvider: 'local' }), { statusCode: 409 });
  driveFileCount = 0;
  await connection.disconnect({ activeProvider: 'local' });
  assert.deepEqual(fake.state.revoked, ['refresh-1']);
  assert.equal((await connection.getStatus()).connected, false);
});

test('switching to a different Google account is refused while files depend on the old one', async () => {
  setup();
  await connect();
  driveFileCount = 1;
  fake.state.email = 'someone-else@example.com';
  fake.state.validRefreshTokens.add('refresh-2');
  await assert.rejects(
    () => connection.saveConnection('refresh-2', { source: 'oauth' }),
    { statusCode: 409, message: /owner@example\.com/ }
  );
  assert.ok(fake.state.revoked.includes('refresh-2'));
  assert.equal((await connection.getStatus()).accountEmail, 'owner@example.com');
});

test('the env refresh token connects once per value and is not re-applied after disconnect', async () => {
  setup();
  process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'refresh-1';
  try {
    assert.equal((await connection.getStatus()).connected, true);
    await connection.disconnect({ activeProvider: 'local' });
    connection._resetForTests();
    assert.equal((await connection.getStatus()).connected, false);
  } finally {
    delete process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  }
});

test('the parent folder can be given as a link or an id', () => {
  assert.equal(parseFolderId('https://drive.google.com/drive/folders/1AbC_d-9?usp=sharing'), '1AbC_d-9');
  assert.equal(parseFolderId('1AbC_d-9'), '1AbC_d-9');
  assert.equal(parseFolderId('not a folder!'), '');
});

test('a backup uploads the dump and records the result', async () => {
  setup();
  await connect();
  const result = await backups.runBackup({ trigger: 'manual' });
  assert.equal(result.status, 'SUCCESS');
  assert.match(result.fileName, /^crm-backup-crm-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-IST\.dump$/);
  const uploaded = fake.files.get(result.fileId);
  assert.equal(uploaded.content.toString(), 'PGDMP fake dump');
  const status = await backups.getBackupStatus();
  assert.equal(status.running, false);
  assert.equal(status.lastSuccess.fileId, result.fileId);
});

test('retention keeps the newest 7 of this database and never touches other files', async () => {
  setup();
  await connect();
  const folderId = await connection.ensureFolder('backup');
  for (let day = 1; day <= 9; day += 1) {
    fake.addFile({ name: `crm-backup-crm-2026-09-0${day}_02-00-00-IST.dump`, parents: [folderId] });
  }
  const others = [
    fake.addFile({ name: 'crm-backup-crm_test-2026-09-01_02-00-00-IST.dump', parents: [folderId] }),
    fake.addFile({ name: 'crm-backup-2026-09-01.json', parents: [folderId] }),
    fake.addFile({ name: 'notes.txt', parents: [folderId] })
  ];

  const result = await backups.runBackup({ trigger: 'schedule' });
  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.removed, 3);
  const own = (await backups.listBackups()).map((file) => file.name);
  assert.equal(own.length, 7);
  assert.equal(own[0], result.fileName);
  for (const other of others) assert.ok(fake.files.has(other.id), `${other.name} must be kept`);
});

test('a pg_dump failure is recorded as FAILED without showing the password', async () => {
  setup();
  await connect();
  const script = path.join(TMP, 'fake-pg-dump.sh');
  fs.writeFileSync(script, '#!/bin/sh\necho "connection failed for password=$PGPASSWORD" >&2\nexit 1\n', { mode: 0o755 });
  backups.setDumpRunnerForTests(null);
  process.env.PG_DUMP_PATH = script;
  try {
    const result = await backups.runBackup({ trigger: 'manual' });
    assert.equal(result.status, 'FAILED');
    assert.match(result.error, /pg_dump exited with code 1/);
    assert.ok(!result.error.includes('s3cret-pass'));
    assert.match(result.error, /\*\*\*/);
    assert.equal((await backups.getBackupStatus()).last.status, 'FAILED');
  } finally {
    delete process.env.PG_DUMP_PATH;
  }
});

test('a missing pg_dump binary gives an install hint', async () => {
  setup();
  await connect();
  backups.setDumpRunnerForTests(null);
  process.env.PG_DUMP_PATH = path.join(TMP, 'does-not-exist');
  try {
    const result = await backups.runBackup();
    assert.match(result.error, /install the PostgreSQL client tools or set PG_DUMP_PATH/i);
  } finally {
    delete process.env.PG_DUMP_PATH;
  }
});

test('concurrent runs return ALREADY_RUNNING', async () => {
  setup();
  await connect();
  let release;
  backups.setDumpRunnerForTests((filePath) => new Promise((resolve) => {
    release = () => {
      fs.writeFileSync(filePath, 'PGDMP');
      resolve();
    };
  }));
  const first = backups.runBackup();
  const second = await backups.runBackup();
  assert.equal(second.status, 'ALREADY_RUNNING');
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  release();
  assert.equal((await first).status, 'SUCCESS');
});

test('another process holding the lock means ALREADY_RUNNING', async () => {
  setup();
  await connect();
  backups.setLockForTests(async () => null);
  assert.equal((await backups.runBackup()).status, 'ALREADY_RUNNING');
});

test('the local download dump sends nothing to Drive and its temp dir is removed', async () => {
  setup();
  const before = fake.calls.length;
  const dump = await backups.makeDump();
  assert.ok(fs.existsSync(dump.filePath));
  await dump.cleanup();
  assert.ok(!fs.existsSync(dump.dir));
  assert.equal(fake.calls.length, before);
});

test('the schedule runs once per India date at or after the hour', async () => {
  setup();
  await connect();
  // 2026-10-05 01:00 IST = 2026-10-04T19:30Z (before the default 02:00)
  assert.equal((await backups.runScheduledBackupIfDue(new Date('2026-10-04T19:30:00Z'))).reason, 'before hour');
  // 02:30 IST
  assert.equal((await backups.runScheduledBackupIfDue(new Date('2026-10-04T21:00:00Z'))).status, 'SUCCESS');
  assert.equal((await backups.runScheduledBackupIfDue(new Date('2026-10-05T10:00:00Z'))).reason, 'already ran today');
  // Next India date
  assert.equal((await backups.runScheduledBackupIfDue(new Date('2026-10-05T21:00:00Z'))).status, 'SUCCESS');

  process.env.GDRIVE_BACKUP_HOUR_IST = '-1';
  try {
    assert.equal((await backups.runScheduledBackupIfDue(new Date('2026-10-07T21:00:00Z'))).reason, 'schedule off');
  } finally {
    delete process.env.GDRIVE_BACKUP_HOUR_IST;
  }
});

test('a failing scheduled backup is not retried the same day', async () => {
  setup();
  await connect();
  backups.setDumpRunnerForTests(async () => {
    throw new Error('dump broke');
  });
  assert.equal((await backups.runScheduledBackupIfDue(new Date('2026-10-04T21:00:00Z'))).status, 'FAILED');
  assert.equal((await backups.runScheduledBackupIfDue(new Date('2026-10-04T22:00:00Z'))).reason, 'already ran today');
});

test('a backup folder deleted in Drive is recreated', async () => {
  setup();
  await connect();
  const firstId = await connection.ensureFolder('backup');
  fake.files.get(firstId).trashed = true;
  const secondId = await connection.ensureFolder('backup');
  assert.notEqual(secondId, firstId);
  assert.equal((await backups.runBackup()).status, 'SUCCESS');
});

test('downloading a Drive file outside the backup list returns 404', async () => {
  setup();
  await connect();
  const stranger = fake.addFile({ name: 'private.pdf', content: Buffer.from('secret') });
  await assert.rejects(() => backups.openBackup(stranger.id), { statusCode: 404 });
  const result = await backups.runBackup();
  const { response } = await backups.openBackup(result.fileId);
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), 'PGDMP fake dump');
});

test('Drive storage mirrors the key folders inside Uploads, then exists / stream / delete', async () => {
  setup();
  await connect();
  const key = `${buildFolderPath({ moduleName: 'leads', entityId: 'lead_abc', date: new Date('2026-10-19T06:00:00Z') })}/quote-x.pdf`;
  assert.equal(key, '2026/oct/leads/lead_abc/quote-x.pdf');

  const locators = await Promise.all([
    gdriveProvider.upload(Buffer.from('one'), key, { mimeType: 'application/pdf' }),
    gdriveProvider.upload(Buffer.from('two'), key.replace('quote-x', 'quote-y'), { mimeType: 'application/pdf' })
  ]);
  const monthFolders = Array.from(fake.files.values()).filter((file) => file.name === 'oct');
  assert.equal(monthFolders.length, 1, 'concurrent uploads must not create duplicate folders');
  assert.equal(fake.pathOf(fake.files.get(locators[0].storageKey)), 'Webitof CRM – Uploads/2026/oct/leads/lead_abc/quote-x.pdf');

  assert.equal(await gdriveProvider.exists(locators[0]), true);
  assert.equal((await gdriveProvider.readBuffer(locators[0])).toString(), 'one');
  await gdriveProvider.delete(locators[0]);
  assert.equal(await gdriveProvider.exists(locators[0]), false);
  assert.equal(await gdriveProvider.open(locators[0]), null);
});

test('Drive upload retries once when a cached folder was deleted', async () => {
  setup();
  await connect();
  await gdriveProvider.upload(Buffer.from('a'), '2026/oct/clients/c1/a.txt', { mimeType: 'text/plain' });
  const folder = Array.from(fake.files.values()).find((file) => file.name === 'c1');
  fake.files.delete(folder.id);
  const locator = await gdriveProvider.upload(Buffer.from('b'), '2026/oct/clients/c1/b.txt', { mimeType: 'text/plain' });
  assert.equal((await gdriveProvider.readBuffer(locator)).toString(), 'b');
});

test('old files keep their own provider after switching the active one', async () => {
  setup();
  await connect();
  const localLocator = await localProvider.upload(Buffer.from('on disk'), '2026/oct/general/old.txt');
  await storage.setActiveProvider('gdrive');
  assert.equal(await storage.getActiveProviderName(), 'gdrive');
  const driveLocator = await storage.upload(Buffer.from('in drive'), '2026/oct/general/new.txt', { mimeType: 'text/plain' });
  assert.equal(driveLocator.storageProvider, 'gdrive');
  assert.equal((await storage.readBuffer(localLocator)).toString(), 'on disk');
  await storage.setActiveProvider('local');
  assert.equal((await storage.readBuffer(driveLocator)).toString(), 'in drive');
});

test('Google Drive cannot be selected for uploads until it is connected', async () => {
  setup();
  await assert.rejects(() => storage.setActiveProvider('gdrive'), { statusCode: 409 });
  assert.equal(await storage.getActiveProviderName(), 'local');
});

test('the upload pipeline enforces the allowlist and records the locator', async () => {
  setup();
  const created = [];
  const originalCreate = fileAssetModel.create;
  fileAssetModel.create = async (data) => {
    created.push(data);
    return { id: 'file_test1', ...data };
  };
  try {
    await assert.rejects(
      () => fileService.saveUpload({ buffer: Buffer.from('<svg onload=alert(1)>'), originalName: 'logo.svg' }),
      { statusCode: 400, message: /Unsupported file type/ }
    );
    await assert.rejects(() => fileService.saveUpload({ buffer: Buffer.alloc(0), originalName: 'a.pdf' }), { statusCode: 400 });
    await assert.rejects(
      () => fileService.saveUpload({ buffer: Buffer.alloc(11), originalName: 'a.pdf', maxBytes: 10 }),
      { statusCode: 400 }
    );

    const saved = await fileService.saveUpload({
      buffer: Buffer.from('%PDF-1.4'),
      originalName: 'Signed Quote (final).PDF',
      moduleName: 'leads',
      entityId: 'lead_abc'
    });
    assert.equal(saved.viewUrl, '/files/file_test1/view');
    assert.equal(created[0].mimeType, 'application/pdf');
    assert.equal(created[0].storageProvider, 'local');
    assert.match(created[0].storedName, /^signed-quote-final-[a-z0-9]+\.pdf$/);
    assert.match(created[0].storageKey, /^\d{4}\/[a-z]{3}\/leads\/lead_abc\/signed-quote-final-/);
    assert.equal(
      (await localProvider.readBuffer({ storageKey: created[0].storageKey })).toString(),
      '%PDF-1.4'
    );
  } finally {
    fileAssetModel.create = originalCreate;
  }
});

test('local storage refuses keys outside its root and serves byte ranges', async () => {
  await assert.rejects(() => localProvider.upload(Buffer.from('x'), '../../escape.txt'));
  await localProvider.upload(Buffer.from('0123456789'), 'range/test.txt');
  const opened = await localProvider.open({ storageKey: 'range/test.txt' }, { range: 'bytes=2-5' });
  assert.equal(opened.status, 206);
  assert.equal(opened.contentRange, 'bytes 2-5/10');
  const chunks = [];
  for await (const chunk of opened.stream) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString(), '2345');
  assert.deepEqual(parseRange('bytes=-3', 10), { start: 7, end: 9 });
  assert.equal(parseRange('bytes=20-30', 10), null);
});

test('site uploads go to site/, everything else to year/month/section/record in India time', () => {
  assert.equal(buildFolderPath({ moduleName: 'settings' }), 'site');
  // 2026-10-31T20:00Z is already 1 November in India.
  assert.equal(buildFolderPath({ moduleName: 'call', entityId: 'call_1', date: new Date('2026-10-31T20:00:00Z') }), '2026/nov/calls/call_1');
  assert.equal(buildFolderPath({ moduleName: 'quotation-master', date: new Date('2026-10-01T00:00:00Z') }), '2026/oct/quotations');
});

test('session auth refuses OAuth state and other purpose-bound tokens', async () => {
  for (const payload of [{ purpose: 'gdrive-connect', uid: 'u' }, { scope: 'file-view', fid: 'f' }]) {
    const token = jwt.sign(payload, process.env.JWT_SECRET);
    let status = 0;
    const res = {
      status(code) {
        status = code;
        return this;
      },
      json() {
        return this;
      }
    };
    await requireAuth({ headers: { authorization: `Bearer ${token}` } }, res, () => assert.fail('must not pass'));
    assert.equal(status, 401);
  }
});

test('a real pg_dump produces a custom-format dump', { skip: !process.env.TEST_DATABASE_URL && 'set TEST_DATABASE_URL to run' }, async () => {
  setup();
  backups.setDumpRunnerForTests(null);
  const saved = process.env.DATABASE_URL;
  const savedSsl = process.env.DB_SSL;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  delete process.env.DB_SSL;
  try {
    const dump = await backups.makeDump();
    const header = fs.readFileSync(dump.filePath).subarray(0, 5).toString();
    await dump.cleanup();
    assert.equal(header, 'PGDMP');
  } finally {
    process.env.DATABASE_URL = saved;
    if (savedSsl !== undefined) process.env.DB_SSL = savedSsl;
  }
});

test('Drive settings saved in Settings win over env, and secrets never come back', async () => {
  setup();
  const view = await driveSettings.saveConfig({
    clientId: 'client-from-settings',
    clientSecret: 'secret-from-settings',
    redirectUri: 'https://crmapi.example.com/api/google-drive/oauth/callback',
    parentFolderId: 'https://drive.google.com/drive/folders/PARENT_1',
    uploadsFolderName: 'CRM Uploads',
    backupKeep: '12',
    backupHourIst: '-1'
  });
  assert.equal(view.values.clientId, 'client-from-settings');
  assert.equal(view.values.clientSecretSet, true);
  assert.equal(view.values.parentFolderId, 'PARENT_1');
  assert.equal(view.values.backupKeep, 12);
  assert.equal(view.values.backupHourIst, -1);
  assert.equal(view.sources.clientId, 'settings');
  assert.equal(view.sources.backupFolderName, 'default');
  assert.ok(!JSON.stringify(view).includes('secret-from-settings'));
  assert.ok(!JSON.stringify(Object.fromEntries(memory.data)).includes('secret-from-settings'), 'secret must be stored encrypted');

  const config = getGoogleDriveConfig();
  assert.equal(config.clientSecret, 'secret-from-settings');
  assert.equal(config.uploadsFolderName, 'CRM Uploads');
  const url = new URL(await connection.getAuthUrl('user_admin'));
  assert.equal(url.searchParams.get('client_id'), 'client-from-settings');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://crmapi.example.com/api/google-drive/oauth/callback');

  // Clearing a field falls back to the env var; leaving a secret out keeps it.
  const cleared = await driveSettings.saveConfig({ clientId: '' });
  assert.equal(cleared.values.clientId, 'client-id');
  assert.equal(cleared.sources.clientId, 'environment');
  assert.equal(cleared.values.clientSecretSet, true);
  assert.equal(getGoogleDriveConfig().clientSecret, 'secret-from-settings');
});

test('Drive settings are validated', async () => {
  setup();
  await assert.rejects(() => driveSettings.saveConfig({ redirectUri: 'not a url' }), { statusCode: 400 });
  await assert.rejects(() => driveSettings.saveConfig({ redirectUri: 'https://x.example.com/other' }), { statusCode: 400 });
  await assert.rejects(() => driveSettings.saveConfig({ parentFolderId: 'not a folder!' }), { statusCode: 400 });
  await assert.rejects(() => driveSettings.saveConfig({ backupKeep: 500 }), { statusCode: 400 });
  await assert.rejects(() => driveSettings.saveConfig({ backupHourIst: 24 }), { statusCode: 400 });
  await assert.rejects(() => driveSettings.saveConfig({ uploadsFolderName: 'a/b' }), { statusCode: 400 });
});

test('secrets cannot be saved without SETTINGS_ENCRYPTION_KEY', async () => {
  setup();
  const saved = process.env.SETTINGS_ENCRYPTION_KEY;
  delete process.env.SETTINGS_ENCRYPTION_KEY;
  try {
    await assert.rejects(() => driveSettings.saveConfig({ clientSecret: 'x' }), { statusCode: 409 });
    assert.equal((await driveSettings.getConfigView()).canStoreSecrets, false);
  } finally {
    process.env.SETTINGS_ENCRYPTION_KEY = saved;
  }
});

test('changing the OAuth client in Settings asks for a reconnect', async () => {
  setup();
  await connect();
  await driveSettings.saveConfig({ clientId: 'another-client' });
  assert.equal((await connection.getStatus()).needsReconnect, true);
});

test('a refresh token saved in Settings connects once, like the env token', async () => {
  setup();
  await driveSettings.saveConfig({ refreshToken: 'refresh-1' });
  const status = await connection.getStatus();
  assert.equal(status.connected, true);
  assert.equal(status.accountEmail, 'owner@example.com');
});

test('renaming a folder in Settings renames the existing Drive folder', async () => {
  setup();
  await connect();
  const id = await connection.ensureFolder('backup');
  await driveSettings.saveConfig({ backupFolderName: 'Renamed Backups' });
  assert.equal(await connection.ensureFolder('backup'), id);
  assert.equal(fake.files.get(id).name, 'Renamed Backups');
});

test('the backup hour saved in Settings drives the schedule', async () => {
  setup();
  await connect();
  await driveSettings.saveConfig({ backupHourIst: '5' });
  // 04:30 IST is before 05:00
  assert.equal((await backups.runScheduledBackupIfDue(new Date('2026-10-04T23:00:00Z'))).reason, 'before hour');
  assert.equal((await backups.runScheduledBackupIfDue(new Date('2026-10-04T23:45:00Z'))).status, 'SUCCESS');
});
