// Maintenance mode: persisted state, the 503 gate, clear rules, request draining. No database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-maint-test-'));
const maintenance = require('../services/maintenance.service');
const { maintenanceGate, inFlight, waitForDrain } = require('../middlewares/maintenance');

let fileCounter = 0;
function freshState() {
  fileCounter += 1;
  const file = path.join(TMP, `state-${fileCounter}`, 'maintenance.json');
  maintenance.setStateFileForTests(file);
  return file;
}

function mockReq(method, urlPath) {
  return { method, path: urlPath };
}

function mockRes() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    res.emit('finish');
    return res;
  };
  return res;
}

test.after(() => {
  maintenance.setStateFileForTests(null);
  fs.rmSync(TMP, { recursive: true, force: true });
});

const START = { reason: 'restore', startedBy: { id: 'user_admin', name: 'Admin' }, backupFile: { id: 'f1', name: 'crm-backup.dump' } };

test('entering maintenance is saved to disk and survives a reload', () => {
  const file = freshState();
  maintenance.enter(START);
  maintenance.setPhase('restore');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.active, true);
  assert.equal(saved.phase, 'restore');

  maintenance.setStateFileForTests(file);
  assert.equal(maintenance.isActive(), false, 'a fresh module state is inactive until loaded');
  maintenance.loadOnStartup();
  assert.equal(maintenance.isActive(), true);
});

test('a restore cut short by a restart is marked interrupted and stays in maintenance', () => {
  const file = freshState();
  maintenance.enter(START);
  maintenance.setStateFileForTests(file);
  maintenance.loadOnStartup();
  const state = maintenance.get();
  assert.equal(state.active, true);
  assert.equal(state.outcome, 'interrupted');
  assert.match(state.error, /server stopped/i);
});

test('entering twice is refused with 409', () => {
  freshState();
  maintenance.enter(START);
  assert.throws(() => maintenance.enter(START), { statusCode: 409 });
});

test('finish records the outcome and leaves maintenance', () => {
  freshState();
  maintenance.enter(START);
  maintenance.finish('failed', 'pg_restore exited with code 1');
  const state = maintenance.get();
  assert.equal(state.active, false);
  assert.equal(state.outcome, 'failed');
  assert.ok(state.finishedAt);
});

test('clear is refused while a restore is running and works after an interruption', () => {
  const file = freshState();
  maintenance.enter(START);
  assert.throws(() => maintenance.clear({ id: 'user_admin' }), { statusCode: 409 });
  maintenance.setStateFileForTests(file);
  maintenance.loadOnStartup();
  maintenance.clear({ id: 'user_admin' });
  assert.equal(maintenance.isActive(), false);
  assert.equal(maintenance.get().outcome, 'interrupted');
});

test('the public state has no user details', () => {
  freshState();
  maintenance.enter(START);
  const view = maintenance.publicState();
  assert.equal(view.active, true);
  assert.equal(view.phase, 'enter-maintenance');
  assert.ok(!JSON.stringify(view).includes('user_admin'));
});

test('the gate returns 503 with the maintenance body and lets health, status and clear through', () => {
  freshState();
  maintenance.enter(START);
  const res = mockRes();
  let passed = false;
  maintenanceGate(mockReq('GET', '/leads'), res, () => { passed = true; });
  assert.equal(passed, false);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, 'MAINTENANCE');
  assert.equal(res.body.message, 'Under maintenance');
  assert.equal(res.body.maintenance.active, true);

  for (const [method, urlPath] of [['GET', '/health'], ['GET', '/maintenance/status'], ['POST', '/maintenance/clear']]) {
    let ok = false;
    maintenanceGate(mockReq(method, urlPath), mockRes(), () => { ok = true; });
    assert.ok(ok, `${method} ${urlPath} must pass`);
  }
});

test('the gate passes everything when maintenance is off', () => {
  freshState();
  let passed = false;
  const res = mockRes();
  maintenanceGate(mockReq('POST', '/invoices'), res, () => { passed = true; });
  assert.ok(passed);
  res.emit('finish');
});

test('waitForDrain resolves once in-flight requests finish, or false after the timeout', async () => {
  freshState();
  const res = mockRes();
  maintenanceGate(mockReq('GET', '/leads'), res, () => {});
  assert.equal(inFlight(), 1);
  assert.equal(await waitForDrain(150), false);
  setTimeout(() => res.emit('finish'), 50);
  assert.equal(await waitForDrain(1000), true);
  assert.equal(inFlight(), 0);
  res.emit('close');
  assert.equal(inFlight(), 0, 'finish then close counts once');
});

test('scheduled jobs are skipped while maintenance is on', () => {
  freshState();
  assert.equal(maintenance.skipDuringMaintenance('AMC'), false);
  maintenance.enter(START);
  assert.equal(maintenance.skipDuringMaintenance('AMC'), true);
});

test('over HTTP: status is public, other API calls get 503 while active, and normal once cleared', async () => {
  freshState();
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  const app = require('../server');
  const server = app.listen(0);
  // API_PREFIX comes from .env ('/api' by default, '/' behind a proxy that strips it).
  const prefix = (process.env.API_PREFIX || '/api').replace(/\/+$/, '');
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  try {
    maintenance.enter(START);
    const status = await (await fetch(`${base}/maintenance/status`)).json();
    assert.equal(status.data.active, true);
    const blocked = await fetch(`${base}/leads`);
    assert.equal(blocked.status, 503);
    assert.equal((await blocked.json()).code, 'MAINTENANCE');
    const legacy = await fetch(`${base}/admin/backup/run`, { method: 'POST' });
    assert.equal(legacy.status, 503);
    const clear = await fetch(`${base}/maintenance/clear`, { method: 'POST' });
    assert.equal(clear.status, 401, 'clear needs a login');

    maintenance.finish('success');
    const open = await fetch(`${base}/leads`);
    assert.equal(open.status, 401, 'back to the normal auth check');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// ─── final-review fixes ──────────────────────────────────────────────────────

test('I2a: once a restore has stopped, login and the profile call get through so an admin can exit', () => {
  const file = freshState();
  maintenance.enter(START);
  for (const [method, urlPath] of [['POST', '/auth/login'], ['GET', '/auth/me']]) {
    const res = mockRes();
    maintenanceGate(mockReq(method, urlPath), res, () => assert.fail('blocked while running'));
    assert.equal(res.statusCode, 503);
  }
  maintenance.setStateFileForTests(file);
  maintenance.loadOnStartup();
  for (const [method, urlPath] of [['POST', '/auth/login'], ['GET', '/auth/me'], ['GET', '/maintenance/details']]) {
    let ok = false;
    const res = mockRes();
    maintenanceGate(mockReq(method, urlPath), res, () => { ok = true; });
    res.emit('finish');
    assert.ok(ok, `${method} ${urlPath} must pass once stopped`);
  }
});

test('I2a: the server-side clear can force its way out, for a stuck restore', () => {
  freshState();
  maintenance.enter(START);
  assert.throws(() => maintenance.clear({ id: 'cli' }), { statusCode: 409 });
  maintenance.clear({ id: 'cli' }, { force: true });
  assert.equal(maintenance.isActive(), false);
});

test('I2c: a state file that cannot be written leaves maintenance off instead of half on', () => {
  const blocker = path.join(TMP, `blocker-${Date.now()}`);
  fs.writeFileSync(blocker, 'not a directory');
  maintenance.setStateFileForTests(path.join(blocker, 'maintenance.json'));
  assert.throws(() => maintenance.enter(START));
  assert.equal(maintenance.isActive(), false);
});

test('I2c: finish always leaves maintenance even when the state file cannot be written', () => {
  const dir = path.join(TMP, `vanish-${Date.now()}`);
  maintenance.setStateFileForTests(path.join(dir, 'maintenance.json'));
  maintenance.enter(START);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.writeFileSync(dir, 'now a file');
  assert.doesNotThrow(() => maintenance.finish('failed', 'x'));
  assert.equal(maintenance.isActive(), false);
});
