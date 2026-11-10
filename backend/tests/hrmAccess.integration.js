// Login access follows employment status (suspend / terminate / reinstate). Needs a disposable
// database (TEST_DATABASE_URL); each test runs in a transaction that is rolled back.
const test = require("node:test");
const assert = require("node:assert/strict");

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
const skip = !url && "set TEST_DATABASE_URL to a disposable database to run";

const { pool } = require("../config/db");
const employees = require("../services/hrm/employees");
const access = require("../services/hrm/access");
const { createId } = require("../utils/format");

async function inRollback(work) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await work(db);
  } finally {
    await db.query("ROLLBACK");
    db.release();
  }
}

async function makeUser(db, { active = true } = {}) {
  const id = createId("user");
  await db.query(
    "INSERT INTO users(id,full_name,username,email,password_hash,is_active,payload) VALUES($1,'Test User',$2,$2,'x',$3,'{}'::jsonb)",
    [id, `${id}@example.test`, active],
  );
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='employee'",
    [id],
  );
  return id;
}

async function actor(db) {
  const id = (
    await db.query(
      "SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' LIMIT 1",
    )
  ).rows[0].user_id;
  return { id, isSuperAdmin: true, permissions: [] };
}

async function loginState(db, userId) {
  const r = await db.query("SELECT is_active,payload->'hrmBlocked' AS block FROM users WHERE id=$1", [userId]);
  return { active: r.rows[0].is_active, block: r.rows[0].block };
}

async function hire(db, hr, extra = {}) {
  const userId = await makeUser(db, extra);
  const e = await employees.save(
    hr,
    { fullName: "Access Test", joiningDate: "2026-01-05", status: "Confirmed", userId },
    null,
    db,
  );
  return { e, userId };
}

test("suspend blocks the login and app devices; reinstate restores both status and login", { skip }, () =>
  inRollback(async (db) => {
    const hr = await actor(db);
    const { e, userId } = await hire(db, hr);
    await db.query("INSERT INTO hrm_devices(id,user_id,token) VALUES($1,$2,$3)", [createId("dev"), userId, createId("tok")]);

    const s = await access.suspend(hr, e.id, { reason: "Inquiry" }, db);
    assert.equal(s.employee.status, "Suspended");
    assert.equal(s.login, "blocked");
    const blocked = await loginState(db, userId);
    assert.equal(blocked.active, false);
    assert.equal(blocked.block.status, "Suspended");
    assert.equal((await db.query("SELECT 1 FROM hrm_devices WHERE user_id=$1", [userId])).rowCount, 0);
    await assert.rejects(access.suspend(hr, e.id, { reason: "Again" }, db), /already Suspended/);

    const r = await access.reinstate(hr, e.id, { reason: "Cleared" }, db);
    assert.equal(r.employee.status, "Confirmed"); // the status before the suspension
    assert.equal(r.login, "restored");
    assert.deepEqual(await loginState(db, userId), { active: true, block: null });
  }));

test("terminate sets the exit date and blocks; rejoin clears the exit on the same record", { skip }, () =>
  inRollback(async (db) => {
    const hr = await actor(db);
    const { e, userId } = await hire(db, hr);
    await assert.rejects(access.terminate(hr, e.id, {}, db), /Reason/);
    const t = await access.terminate(hr, e.id, { reason: "Misconduct", exitDate: "2026-02-10" }, db);
    assert.equal(t.employee.status, "Terminated");
    assert.equal(t.employee.exitDate, "2026-02-10");
    assert.equal((await loginState(db, userId)).block.status, "Terminated");
    const checklist = await db.query("SELECT count(*)::int AS n FROM hrm_records WHERE employee_id=$1 AND kind='offboarding'", [e.id]);
    assert.ok(checklist.rows[0].n > 0);

    const r = await access.reinstate(hr, e.id, { reason: "Rehired", status: "Probation" }, db);
    assert.equal(r.employee.status, "Probation");
    assert.equal(r.employee.exitDate, null);
    assert.equal(r.employee.employeeNumber, e.employeeNumber);
    assert.equal((await loginState(db, userId)).active, true);
  }));

test("a login an admin disabled stays disabled after HR reinstates", { skip }, () =>
  inRollback(async (db) => {
    const hr = await actor(db);
    const { e, userId } = await hire(db, hr);
    await db.query("UPDATE users SET is_active=false WHERE id=$1", [userId]);
    assert.equal((await access.suspend(hr, e.id, { reason: "x" }, db)).login, "disabled");
    assert.equal((await access.reinstate(hr, e.id, { reason: "y" }, db)).login, "disabled");
    assert.equal((await loginState(db, userId)).active, false);
  }));

test("status changes from the employee form follow the same rule and need HR approval", { skip }, () =>
  inRollback(async (db) => {
    const hr = await actor(db);
    const { e, userId } = await hire(db, hr);
    const clerk = { id: hr.id, permissions: ["hrm.manage_employees", "hrm.view_all"] };
    await assert.rejects(
      employees.save(clerk, { status: "Terminated", version: e.version }, e.id, db),
      /HR approval/,
    );
    const saved = await employees.save(hr, { status: "Inactive", version: e.version }, e.id, db);
    assert.equal((await loginState(db, userId)).active, false);
    await employees.save(hr, { status: "Active", version: saved.version }, e.id, db);
    assert.equal((await loginState(db, userId)).active, true);
  }));

test("nobody can block their own login", { skip }, () =>
  inRollback(async (db) => {
    const hr = await actor(db);
    const userId = await makeUser(db);
    const e = await employees.save(hr, { fullName: "Self", joiningDate: "2026-01-05", status: "Active", userId }, null, db);
    const self = { id: userId, isSuperAdmin: true, permissions: [] };
    await assert.rejects(access.suspend(self, e.id, { reason: "x" }, db), /your own login/);
  }));

test("login message tells a suspended or exited employee to contact HR", () => {
  assert.match(access.blockedLoginMessage({ status: "Suspended" }), /suspended/);
  assert.match(access.blockedLoginMessage({ status: "Terminated" }), /employment has ended/);
  assert.match(access.blockedLoginMessage(null), /disabled/);
});

test.after(() => pool.end());

test("profile summary gives the Overview numbers and tab counts", { skip }, () =>
  inRollback(async (db) => {
    const summary = require("../services/hrm/profileSummary");
    const hr = await actor(db);
    const { e } = await hire(db, hr);
    const s = await summary.summary(hr, e.id, db);
    assert.equal(s.today, null);
    assert.equal(typeof s.month.present, "number");
    assert.ok(Array.isArray(s.leave.types));
    assert.equal(s.documents.total, 0);
    assert.ok(s.onboarding.total > 0); // the joining checklist
    assert.equal(s.badges.onboarding.attention, true);
    assert.ok(Array.isArray(s.activity)); // super admin can read the audit
    const detail = await employees.detail(hr, e.id, db);
    assert.equal(detail.managerName, null);
    assert.equal(detail.login.active, true);
  }));
