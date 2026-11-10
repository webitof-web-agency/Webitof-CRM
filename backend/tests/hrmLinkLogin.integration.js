// Linking an existing ERP login to an employee. Needs a disposable database (TEST_DATABASE_URL);
// everything runs in one transaction that is rolled back, so nothing is left behind.
const test = require("node:test");
const assert = require("node:assert/strict");

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
const skip = !url && "set TEST_DATABASE_URL to a disposable database to run";

const { pool } = require("../config/db");
const employees = require("../services/hrm/employees");
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

async function makeUser(db, { roleCode = null, active = true, phone = "+91 98765 00000" } = {}) {
  const id = createId("user");
  const email = `${id}@example.test`;
  await db.query(
    "INSERT INTO users(id,full_name,username,email,phone,password_hash,is_active,payload) VALUES($1,$2,$3,$3,$4,'x',$5,'{}'::jsonb)",
    [id, `Test ${id.slice(-6)}`, email, phone, active],
  );
  if (roleCode)
    await db.query(
      "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code=$2",
      [id, roleCode],
    );
  return { id, email };
}

async function roleCodes(db, userId) {
  return (
    await db.query(
      "SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 ORDER BY 1",
      [userId],
    )
  ).rows.map((r) => r.code);
}

async function actor(db) {
  const id = (
    await db.query(
      "SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' LIMIT 1",
    )
  ).rows[0].user_id;
  return { id, isSuperAdmin: true, permissions: [] };
}

const base = (extra = {}) => ({ joiningDate: "2026-01-05", status: "Active", ...extra });

test("creating an employee from an existing login fills blanks and keeps its roles", { skip }, () =>
  inRollback(async (db) => {
    const hr = await actor(db);
    // As on live installs, Sales carries HRM self service (rolled back with the rest).
    await db.query(
      `INSERT INTO role_permissions(role_id,permission_id)
       SELECT r.id,p.id FROM roles r, permissions p
       WHERE r.code='sales' AND p.code IN ('hrm.view_own','hrm.self_service') ON CONFLICT DO NOTHING`,
    );
    const login = await makeUser(db, { roleCode: "sales" });
    const saved = await employees.save(hr, base({ userId: login.id }), null, db);
    assert.equal(saved.userId, login.id);
    assert.equal(saved.companyEmail, login.email);
    assert.equal(saved.phone, "+91 98765 00000");
    assert.deepEqual(await roleCodes(db, login.id), ["sales"]);
  }));

test("a login without HRM self service gets the Employee role added", { skip }, () =>
  inRollback(async (db) => {
    const hr = await actor(db);
    const login = await makeUser(db);
    await employees.save(hr, base({ userId: login.id, fullName: "No Role" }), null, db);
    assert.deepEqual(await roleCodes(db, login.id), ["employee"]);
  }));

test("an existing employee without a login can be linked later, but never re-linked", { skip }, () =>
  inRollback(async (db) => {
    const hr = await actor(db);
    const first = await employees.save(hr, base({ fullName: "Later Link" }), null, db);
    assert.equal(first.userId, null);
    const login = await makeUser(db, { roleCode: "sales" });
    const linked = await employees.save(hr, { userId: login.id, version: first.version }, first.id, db);
    assert.equal(linked.userId, login.id);
    const other = await makeUser(db, { roleCode: "sales" });
    await assert.rejects(
      employees.save(hr, { userId: other.id, version: linked.version }, first.id, db),
      /cannot be reassigned/,
    );
  }));

test("inactive or already linked logins are refused with a clear message", { skip }, () =>
  inRollback(async (db) => {
    const hr = await actor(db);
    const inactive = await makeUser(db, { roleCode: "sales", active: false });
    await assert.rejects(
      employees.save(hr, base({ userId: inactive.id, fullName: "Inactive" }), null, db),
      /inactive/,
    );
    const login = await makeUser(db, { roleCode: "sales" });
    await employees.save(hr, base({ userId: login.id, fullName: "First" }), null, db);
    await assert.rejects(
      employees.save(hr, base({ userId: login.id, fullName: "Second" }), null, db),
      /already linked to employee First/,
    );
  }));

test.after(() => pool.end());
