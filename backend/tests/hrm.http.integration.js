const test = require("node:test");
const assert = require("node:assert/strict");
const database = require("../config/db");
test("actual HTTP login, existing routes and HR authorization work on rollback-only fixtures", async () => {
  const db = await database.pool.connect();
  const originalQuery = database.pool.query;
  const originalTransaction = database.withTransaction;
  await db.query("BEGIN");
  let server;
  try {
    await require("../database/migrate-hrm").migrate(db);
    database.pool.query = (sql, params) => db.query(sql, params);
    let seq = 0;
    database.withTransaction = async (fn) => {
      const name = `hrm_http_${++seq}`;
      await db.query(`SAVEPOINT ${name}`);
      try {
        const value = await fn(db);
        await db.query(`RELEASE SAVEPOINT ${name}`);
        return value;
      } catch (e) {
        await db.query(`ROLLBACK TO SAVEPOINT ${name}`);
        throw e;
      }
    };
    const c = require("../services/hrm/core");
    const bcrypt = require("bcryptjs");
    const password = "Test-only-Hrm-2026!";
    const u = await c.insert(db, "users", {
      fullName: "HR HTTP fixture",
      username: `hr-http-${Date.now()}`,
      email: `hr-http-${Date.now()}@example.test`,
      passwordHash: await bcrypt.hash(password, 4),
      isActive: true,
    });
    const role = await c.insert(db, "roles", {
      code: `hr-http-${Date.now()}`,
      name: "HR HTTP fixture role",
    });
    await db.query("INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)", [
      u.id,
      role.id,
    ]);
    await db.query(
      "INSERT INTO role_permissions(role_id,permission_id) SELECT $1,id FROM permissions WHERE code=ANY($2::text[])",
      [role.id, ["hrm.view_own", "hrm.self_service"]],
    );
    const adminRow = (
      await db.query(
        "SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' AND u.is_active=true LIMIT 1",
      )
    ).rows[0];
    assert.ok(adminRow);
    const auth = require("../services/auth.service");
    const admin = await auth.getUserAccessProfile(adminRow.id);
    const e = await require("../services/hrm/employees").save(
      admin,
      { userId: u.id, joiningDate: "2026-08-01", status: "Active" },
      null,
      db,
    );
    server = require("../server").listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    let response = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: u.username, password }),
    });
    assert.equal(response.status, 200);
    const token = (await response.json()).data.token;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    response = await fetch(`${base}/hrm/meta`, { headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.ownEmployeeId, e.id);
    for (const endpoint of [
      "/employees",
      "/lookups?type=employees",
      "/lookups?type=projects",
      "/lookups?type=documents",
      "/resources/attendance",
      "/resources/work-reports",
      "/resources/asset",
      "/payroll",
      "/dashboard",
      "/analytics",
    ]) {
      response = await fetch(`${base}/hrm${endpoint}`, { headers });
      assert.equal(
        response.status,
        200,
        `${endpoint}: ${await response.text()}`,
      );
    }
    response = await fetch(`${base}/hrm/resources/salary-history`, { headers });
    assert.equal(response.status, 403);
    response = await fetch(`${base}/hrm/employees/${e.id}/private`, {
      headers,
    });
    assert.equal(response.status, 403);
    response = await fetch(`${base}/hrm/policy`, {
      method: "PUT",
      headers,
      body: "{}",
    });
    assert.equal(response.status, 403);
    response = await fetch(`${base}/hrm/employees`);
    assert.equal(response.status, 401);
    const adminToken = auth.signToken({ sub: admin.id });
    for (const endpoint of [
      "/auth/me",
      "/users",
      "/clients",
      "/projects",
      "/leads",
      "/expenses",
      "/invoices",
      "/payments",
      "/finance/summary",
      "/reports/dashboard",
    ]) {
      response = await fetch(`${base}${endpoint}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.ok(
        response.status === 200,
        `${endpoint}: ${response.status}`,
      );
    }
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    database.pool.query = originalQuery;
    database.withTransaction = originalTransaction;
    await db.query("ROLLBACK");
    db.release();
    await database.pool.end();
  }
});
