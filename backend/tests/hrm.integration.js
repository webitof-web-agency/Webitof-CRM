const test = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../config/db");
const { migrate } = require("../database/migrate-hrm");
const c = require("../services/hrm/core");
const employees = require("../services/hrm/employees");
const queries = require("../services/hrm/queries");
const work = require("../services/hrm/work");
const ops = require("../services/hrm/operations");
const payroll = require("../services/hrm/payroll");
const life = require("../services/hrm/lifecycle");
const analytics = require("../services/hrm/analytics");
test("HRM migration, workflows, privacy and finance integration roll back without changing existing data", async () => {
  const db = await pool.connect();
  await db.query("BEGIN");
  try {
    await migrate(db);
    await migrate(db);
    const suffix = Date.now();
    const makeUser = async (name) =>
      c.insert(db, "users", {
        fullName: name,
        username: `hrm-${name}-${suffix}`,
        email: `hrm-${name}-${suffix}@example.test`,
        passwordHash: "integration-only",
        isActive: true,
      });
    const au = await makeUser("admin"),
      mu = await makeUser("manager"),
      su = await makeUser("staff"),
      ou = await makeUser("outsider");
    const admin = { id: au.id, isSuperAdmin: true };
    const manager = {
      id: mu.id,
      permissions: [
        "hrm.view_own",
        "hrm.view_team",
        "hrm.approve",
        "hrm.self_service",
      ],
    };
    const staff = {
      id: su.id,
      permissions: ["hrm.view_own", "hrm.self_service"],
    };
    const outsider = {
      id: ou.id,
      permissions: ["hrm.view_own", "hrm.self_service"],
    };
    const dept = await queries.masters(
      admin,
      "department",
      { name: "Engineering", payload: {} },
      null,
      db,
    );
    const m = await employees.save(
      admin,
      {
        userId: mu.id,
        joiningDate: "2026-08-01",
        status: "Active",
        departmentId: dept.id,
      },
      null,
      db,
    );
    const e = await employees.save(
      admin,
      {
        userId: su.id,
        joiningDate: "2026-08-01",
        status: "Active",
        managerId: m.id,
        departmentId: dept.id,
      },
      null,
      db,
    );
    assert.equal(e.fullName, "staff");
    assert.ok(e.employeeNumber);
    assert.ok(
      (await queries.list(staff, "onboarding", { employeeId: e.id }, db))
        .total > 0,
    );
    assert.equal((await employees.list(outsider, {}, db)).total, 0);
    assert.equal((await employees.list(manager, {}, db)).total, 2);
    await assert.rejects(() => employees.detail(outsider, e.id, db), {
      statusCode: 404,
    });
    await employees.privateProfile(
      admin,
      e.id,
      {
        profile: { personalEmail: "private@example.test" },
        financial: { accountNumber: "secret-account", pan: "secret-pan" },
      },
      db,
    );
    assert.equal(
      (await employees.detail(manager, e.id, db)).profile,
      undefined,
    );
    await assert.rejects(
      () => employees.privateProfile(manager, e.id, null, db),
      { statusCode: 403 },
    );
    const leaveType = await queries.masters(
      admin,
      "leave_type",
      {
        name: "Paid",
        payload: { annualDays: 12, paid: true, halfDayAllowed: true },
      },
      null,
      db,
    );
    await ops.grantLeave(
      admin,
      {
        employeeId: e.id,
        leaveTypeId: leaveType.id,
        year: 2026,
        amount: 12,
        reason: "Annual allocation",
        sourceKey: `test-grant-${suffix}`,
      },
      db,
    );
    const leave = await ops.request(
      staff,
      {
        employeeId: e.id,
        kind: "leave",
        title: "Planned leave",
        startDate: "2026-08-04",
        endDate: "2026-08-04",
        details: { leaveTypeId: leaveType.id, fraction: 1, reason: "Personal" },
      },
      null,
      db,
    );
    await assert.rejects(
      () => ops.approveRequest(staff, leave.id, { action: "approve" }, db),
      { statusCode: 403 },
    );
    await ops.approveRequest(manager, leave.id, { action: "approve" }, db);
    assert.equal(
      Number((await ops.leaveBalance(staff, e.id, 2026, db))[0].balance),
      11,
    );
    await assert.rejects(
      () => ops.approveRequest(manager, leave.id, { action: "approve" }, db),
      { statusCode: 409 },
    );
    assert.equal(
      Number((await ops.leaveBalance(staff, e.id, 2026, db))[0].balance),
      11,
    );
    const project = await c.insert(db, "projects", {
      title: "HRM integration project",
      payload: JSON.stringify({
        assignedTo: su.id,
        activities: [
          {
            id: "test-task",
            type: "task",
            title: "Deliver feature",
            assignedTo: su.id,
            status: "In progress",
          },
        ],
      }),
    });
    const taskRows = await work.tasks(staff, e.id, project.id, db);
    assert.equal(taskRows.length, 1);
    await employees.savePolicy(admin, { maxBackdateDays: 366 }, db);
    const report = await work.saveReport(
      staff,
      {
        employeeId: e.id,
        workDate: "2026-08-03",
        summary: "Delivery",
        entries: [
          {
            projectId: project.id,
            taskId: "test-task",
            taskSource: "activity",
            description: "Implemented feature",
            minutes: 480,
            billable: true,
          },
        ],
      },
      null,
      db,
    );
    await work.reportAction(staff, report.id, { action: "submit" }, db);
    await work.reportAction(manager, report.id, { action: "approve" }, db);
    await assert.rejects(
      () =>
        work.saveReport(
          staff,
          { employeeId: e.id, workDate: "2026-08-03", version: 3, entries: [] },
          report.id,
          db,
        ),
      { statusCode: 409 },
    );
    assert.equal(
      (await work.reportDetail(staff, report.id, db)).entries[0].minutes,
      480,
    );
    const timesheet = await work.timesheet(
      staff,
      { employeeId: e.id, startDate: "2026-08-03", endDate: "2026-08-03" },
      null,
      db,
    );
    await work.timesheet(manager, { status: "Approved" }, timesheet.id, db);
    assert.deepEqual(timesheet.reportIds, [report.id]);
    await work.allocation(
      admin,
      {
        employeeId: e.id,
        projectId: project.id,
        role: "Engineer",
        percent: 60,
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      },
      null,
      db,
    );
    await assert.rejects(() =>
      work.allocation(
        admin,
        {
          employeeId: e.id,
          projectId: project.id,
          role: "Engineer",
          percent: 50,
          startDate: "2026-08-01",
          endDate: "2026-08-31",
        },
        null,
        db,
      ),
    );
    const doc = await life.uploadDocument(
      staff,
      { employeeId: e.id, title: "Receipt", category: "Reimbursement" },
      {
        originalname: "receipt.pdf",
        mimetype: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\nIntegration receipt"),
      },
      db,
    );
    assert.equal(doc.content, undefined);
    assert.equal((await queries.list(manager, "documents", {}, db)).total, 0);
    await assert.rejects(() => life.document(manager, doc.id, {}, db), {
      statusCode: 403,
    });
    assert.ok((await life.document(staff, doc.id, {}, db)).content.length);
    const category = await c.insert(db, "master_items", {
      name: "Test expense category",
      type: "expense_category",
    });
    const claim = await ops.request(
      staff,
      {
        employeeId: e.id,
        kind: "reimbursement",
        title: "Client travel",
        startDate: "2026-08-03",
        details: {
          amount: 250,
          categoryId: category.id,
          reason: "Travel",
          documentId: doc.id,
        },
      },
      null,
      db,
    );
    assert.equal(
      (await ops.approveRequest(manager, claim.id, { action: "approve" }, db))
        .status,
      "Manager Approved",
    );
    const approved = await ops.approveRequest(
      admin,
      claim.id,
      { action: "approve" },
      db,
    );
    assert.ok(approved.details.expenseId);
    assert.equal(
      Number(
        (
          await db.query("SELECT total_amount FROM expenses WHERE id=$1", [
            approved.details.expenseId,
          ])
        ).rows[0].total_amount,
      ),
      250,
    );
    await payroll.salary(
      admin,
      {
        employeeId: e.id,
        effectiveDate: "2026-08-01",
        monthlyCost: 30000,
        currency: "INR",
        components: [],
        reason: "Initial salary",
      },
      db,
    );
    await payroll.salary(
      admin,
      {
        employeeId: e.id,
        effectiveDate: "2026-09-01",
        monthlyCost: 40000,
        currency: "INR",
        components: [],
        reason: "Revision",
      },
      db,
    );
    await assert.rejects(
      () => queries.list(manager, "salary-history", {}, db),
      { statusCode: 403 },
    );
    const score = await analytics.analytics(
      staff,
      { employeeId: e.id, startDate: "2026-08-01", endDate: "2026-08-31" },
      db,
    );
    assert.equal(score.rows[0].loggedHours, 8);
    assert.equal(score.rows[0].cost, undefined);
    const cost = await analytics.analytics(
      admin,
      { employeeId: e.id, startDate: "2026-08-01", endDate: "2026-08-31" },
      db,
    );
    assert.ok(cost.rows[0].cost.approvedProjectCost > 0);
    assert.ok(cost.rows[0].cost.approvedProjectCost < 2000);
    for (const day of c.days("2026-08-01", "2026-08-31"))
      if (![0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay()))
        await db.query(
          "INSERT INTO hrm_attendance(id,employee_id,work_date,status,check_in,check_out,worked_minutes) VALUES($1,$2,$3,'Present',$4,$5,480) ON CONFLICT(employee_id,work_date) DO NOTHING",
          [
            require("../utils/format").createId("att"),
            e.id,
            day,
            `${day}T03:30:00Z`,
            `${day}T12:30:00Z`,
          ],
        );
    const draft = await payroll.draft(
      admin,
      { startDate: "2026-08-01", endDate: "2026-08-31", employeeIds: [e.id] },
      db,
    );
    assert.equal(Number(draft.entries[0].gross), 30000);
    await payroll.action(admin, draft.id, { action: "review" }, db);
    const financeUser = {
      id: mu.id,
      permissions: [
        "hrm.view_team",
        "hrm.view_salary",
        "hrm.approve_payroll",
        "hrm.finance",
      ],
    };
    await payroll.action(financeUser, draft.id, { action: "approve" }, db);
    await payroll.action(admin, draft.id, { action: "post" }, db);
    const slip = await payroll.payslip(staff, draft.entries[0].id, db);
    assert.equal(Number(slip.gross), 30000);
    assert.ok(slip.expenseId);
    const job = await life.record(
      admin,
      "job",
      { title: "Engineer", status: "Open", details: { openings: 1 } },
      null,
      db,
    );
    const candidate = await life.record(
      admin,
      "candidate",
      {
        title: "Future colleague",
        status: "Selected",
        parentId: job.id,
        details: { email: `candidate-${suffix}@example.test` },
      },
      null,
      db,
    );
    const hire = await life.convertCandidate(
      admin,
      candidate.id,
      { joiningDate: "2026-09-07", status: "Upcoming Joining" },
      db,
    );
    assert.ok(hire.id);
    await assert.rejects(
      () =>
        life.convertCandidate(
          admin,
          candidate.id,
          { joiningDate: "2026-09-07" },
          db,
        ),
      { statusCode: 409 },
    );
    const goal = await life.record(
      staff,
      "goal",
      {
        employeeId: e.id,
        title: "Release milestone",
        status: "In Progress",
        details: { progress: 50 },
      },
      null,
      db,
    );
    assert.equal(goal.details.progress, 50);
    const dashboard = await analytics.dashboard(
      manager,
      { startDate: "2026-08-01", endDate: "2026-08-31" },
      db,
    );
    assert.equal(dashboard.totalEmployees, 2);
    assert.ok(
      (await queries.list(admin, "audit", { employeeId: e.id }, db)).total > 5,
    );
  } finally {
    await db.query("ROLLBACK");
    db.release();
    await pool.end();
  }
});
