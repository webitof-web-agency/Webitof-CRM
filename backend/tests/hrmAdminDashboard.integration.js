// GET /hrm/dashboard/overview against a real (disposable) database.
require("./helpers/requireTestDb");
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { query, pool } = require("../config/db");
const c = require("../services/hrm/core");
const { overview, _private } = require("../services/hrm/adminDashboard");

const tag = crypto.randomBytes(4).toString("hex");
const adminUserId = `user_hadm_${tag}`;
const ids = { employees: [], users: [adminUserId], requests: [], alerts: [], attendance: [], documents: [] };
let today;

const ADMIN = {
  id: adminUserId,
  permissions: ["hrm.view_all", "hrm.approve", "hrm.hr_approve", "hrm.manage_employees", "hrm.view_salary", "hrm.recruitment"],
};

async function user(id) {
  await query(
    "insert into users(id, full_name, username, email, password_hash, is_active, payload) values ($1, $1, $1, $1 || '@example.test', 'x', true, '{}'::jsonb)",
    [id],
  );
}

async function employee(name, extra = {}) {
  const id = `hrm_emp_${tag}_${ids.employees.length}`;
  const userId = `user_hemp_${tag}_${ids.employees.length}`;
  await user(userId);
  ids.users.push(userId);
  ids.employees.push(id);
  await query(
    `insert into hrm_employees(id, employee_number, user_id, full_name, status, joining_date, probation_end, exit_date)
     values ($1, $2, $3, $4, $5, $6::date, $7::date, $8::date)`,
    [id, `T-${tag}-${ids.employees.length}`, userId, name, extra.status || "Active", extra.joining || "2024-01-15", extra.probationEnd || null, extra.exitDate || null],
  );
  if (extra.dob) await query("insert into hrm_private_profiles(employee_id, details) values ($1, jsonb_build_object('dob', $2::text))", [id, extra.dob]);
  return id;
}

test.before(async () => {
  today = c.today(await c.policy(c.dbDefault));
  await user(adminUserId);
  const late = await employee(`Late Lata ${tag}`, { dob: `1990-${today.slice(5, 10)}` });
  const onLeave = await employee(`Leave Lalit ${tag}`, { probationEnd: _private.addDays(today, 5) });
  const asking = await employee(`Asking Asha ${tag}`, { joining: `2023-${today.slice(5, 10)}` });

  const att = `hrm_att_${tag}`;
  ids.attendance.push(att);
  await query(
    `insert into hrm_attendance(id, employee_id, work_date, status, check_in, late_minutes, work_mode)
     values ($1, $2, $3::date, 'Present', now() - interval '2 hours', 25, 'WFH')`,
    [att, late, today],
  );
  const leaveId = `hrm_req_${tag}_leave`;
  const pendingId = `hrm_req_${tag}_pending`;
  ids.requests.push(leaveId, pendingId);
  await query(
    `insert into hrm_requests(id, employee_id, kind, title, start_date, end_date, status, details)
     values ($1, $2, 'leave', 'Sick', $3::date, $3::date, 'Approved', '{}'::jsonb),
            ($4, $5, 'leave', 'Cousin wedding', $6::date, $7::date, 'Submitted', '{"days": 2}'::jsonb)`,
    [leaveId, onLeave, today, pendingId, asking, _private.addDays(today, 10), _private.addDays(today, 11)],
  );
  const alertId = `hrm_alert_${tag}`;
  ids.alerts.push(alertId);
  await query(
    `insert into hrm_alerts(id, employee_id, attendance_id, work_date, kind, status, title)
     values ($1, $2, $3, $4::date, 'out_of_zone', 'Open', 'Left the work location')`,
    [alertId, late, att, today],
  );
  const docId = `hrm_doc_${tag}`;
  ids.documents.push(docId);
  await query(
    `insert into hrm_documents(id, employee_id, title, category, file_name, mime_type, size_bytes, content, expires_on)
     values ($1, $2, 'Passport', 'ID', 'p.pdf', 'application/pdf', 3, '\\x010203'::bytea, $3::date)`,
    [docId, asking, _private.addDays(today, 12)],
  );
});

test.after(async () => {
  await query("delete from hrm_alerts where id = any($1::text[])", [ids.alerts]);
  await query("delete from hrm_documents where id = any($1::text[])", [ids.documents]);
  await query("delete from hrm_requests where employee_id = any($1::text[])", [ids.employees]);
  await query("delete from hrm_audit where employee_id = any($1::text[])", [ids.employees]);
  await query("delete from notifications where user_id = any($1::text[])", [ids.users]);
  await query("delete from hrm_leave_ledger where employee_id = any($1::text[])", [ids.employees]);
  // Approving a leave writes On Leave attendance rows for its days, so clear by employee too.
  await query("delete from hrm_attendance where id = any($1::text[]) or employee_id = any($2::text[])", [ids.attendance, ids.employees]);
  await query("delete from hrm_private_profiles where employee_id = any($1::text[])", [ids.employees]);
  await query("delete from hrm_employees where id = any($1::text[])", [ids.employees]);
  await query("delete from users where id = any($1::text[])", [ids.users]);
  await pool.end();
});

const mine = (rows = []) => rows.filter((r) => ids.employees.includes(r.employeeId));

test("every block loads for an HR admin with full access", async () => {
  const data = await overview(ADMIN, {});
  for (const name of ["board", "approvals", "alerts", "away", "upcoming", "productivity", "utilization", "movement", "payroll", "recruitment"]) {
    assert.ok(data[name] && !data[name].error, `${name} should load`);
  }
  assert.ok(Array.isArray(data.trend), "the existing summary fields are still there");
});

test("today's board groups people: late + remote, on leave", async () => {
  const { board } = await overview(ADMIN, {});
  const lata = mine(board.groups.late).find((p) => p.name.startsWith("Late Lata"));
  assert.ok(lata, "late employee is in the late group");
  assert.equal(lata.lateMinutes, 25);
  assert.ok(mine(board.groups.remote).some((p) => p.name.startsWith("Late Lata")), "WFH counts as remote");
  assert.ok(mine(board.groups.leave).some((p) => p.name.startsWith("Leave Lalit")), "approved leave today");
  assert.ok(!mine(board.groups.present).some((p) => p.name.startsWith("Leave Lalit")));
});

test("pending requests, alerts, who is away and coming-up dates", async () => {
  const data = await overview(ADMIN, {});
  const request = data.approvals.items.find((r) => r.id === `hrm_req_${tag}_pending`);
  assert.ok(request && request.canAct && request.days === 2, "pending leave can be approved from the dashboard");
  assert.ok(data.alerts.items.some((a) => a.id === `hrm_alert_${tag}`));
  assert.ok(data.away.today.some((l) => l.employee.startsWith("Leave Lalit")));

  const events = data.upcoming.events.filter((e) => ids.employees.includes(e.employeeId));
  const types = events.map((e) => e.type).sort();
  assert.deepEqual(types, ["anniversary", "birthday", "document", "probation"]);
  assert.equal(events.find((e) => e.type === "birthday").in, 0);
  assert.equal(events.find((e) => e.type === "anniversary").years, Number(today.slice(0, 4)) - 2023);
});

test("blocks need their permission: a team manager sees no payroll or recruitment", async () => {
  const data = await overview({ id: adminUserId, permissions: ["hrm.view_team", "hrm.approve"] }, {});
  assert.equal(data.payroll, null);
  assert.equal(data.recruitment, null);
  assert.equal(mine(data.board.groups.present).length, 0, "employees outside the manager's team are not shown");
});

test("approving from the dashboard uses the normal request action", async () => {
  const { approveRequest } = require("../services/hrm/operations");
  const result = await approveRequest(ADMIN, `hrm_req_${tag}_pending`, { action: "approve" });
  assert.ok(["Approved", "Manager Approved"].includes(result.status));
  const after = await overview(ADMIN, {});
  const still = after.approvals.items.find((r) => r.id === `hrm_req_${tag}_pending`);
  assert.ok(!still || still.status === "Manager Approved");
});
