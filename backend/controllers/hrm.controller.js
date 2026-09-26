const c = require("../services/hrm/core");
const employees = require("../services/hrm/employees");
const queries = require("../services/hrm/queries");
const work = require("../services/hrm/work");
const operations = require("../services/hrm/operations");
const finance = require("../services/hrm/payroll");
const lifecycle = require("../services/hrm/lifecycle");
const analytics = require("../services/hrm/analytics");
const respond =
  (work, status = 200) =>
  async (req, res, next) => {
    try {
      res.set("Cache-Control", "no-store");
      res.status(status).json({ success: true, data: await work(req) });
    } catch (e) {
      if (["23505", "23P01"].includes(e.code)) {
        e.statusCode = 409;
        e.message =
          "A conflicting record already exists. Refresh and try again.";
      }
      if (e.code === "23503" || e.code === "23514") {
        e.statusCode = 400;
        e.message = "A referenced record or value is invalid.";
      }
      if (e.code === "42P01") {
        e.statusCode = 503;
        e.message =
          "HRM database migration has not been applied. Run the HRM migration before using this module.";
      }
      next(e);
    }
  };
const controller = {
  meta: respond(async (req) => ({
    ownEmployeeId:
      (
        await c.dbDefault.query(
          "SELECT id FROM hrm_employees WHERE user_id=$1 AND archived_at IS NULL",
          [req.user.id],
        )
      ).rows[0]?.id || null,
    policy: await c.policy(),
    employeeStatuses: require("../config/hrm").EMPLOYEE_STATUSES,
    workModes: require("../config/hrm").WORK_MODES,
    masterTypes: require("../config/hrm").MASTER_TYPES,
    records: require("../config/hrmRecords").RECORDS,
  })),
  lookups: respond((req) => queries.lookups(req.user, req.query)),
  employees: respond((req) => employees.list(req.user, req.query)),
  employee: respond((req) => employees.detail(req.user, req.params.id)),
  saveEmployee: respond((req) =>
    employees.save(req.user, req.body, req.params.id || null),
  ),
  archiveEmployee: respond((req) => employees.archive(req.user, req.params.id)),
  privateProfile: respond((req) =>
    employees.privateProfile(
      req.user,
      req.params.id,
      req.method === "PUT" ? req.body : null,
    ),
  ),
  policy: respond((req) => employees.savePolicy(req.user, req.body)),
  list: respond((req) => queries.list(req.user, req.params.kind, req.query)),
  master: respond((req) =>
    queries.masters(req.user, req.params.type, req.body, req.params.id || null),
  ),
  holidays: respond((req) =>
    queries.holidays(
      req.user,
      req.method === "GET" ? null : req.body,
      req.params.id || null,
    ),
  ),
  markAttendance: respond((req) =>
    require("../services/hrm/attendanceAdmin").mark(req.user, req.body),
  ),
  clock: respond((req) => operations.clock(req.user, req.body)),
  leaveBalance: respond((req) =>
    operations.leaveBalance(
      req.user,
      req.params.id,
      req.query.year || new Date().getUTCFullYear(),
    ),
  ),
  grantLeave: respond((req) => operations.grantLeave(req.user, req.body)),
  request: respond((req) =>
    operations.request(req.user, req.body, req.params.id || null),
  ),
  approveRequest: respond((req) =>
    operations.approveRequest(req.user, req.params.id, req.body),
  ),
  tasks: respond((req) =>
    work.tasks(req.user, req.query.employeeId, req.query.projectId),
  ),
  saveReport: respond((req) =>
    work.saveReport(req.user, req.body, req.params.id || null),
  ),
  reportDetail: respond((req) => work.reportDetail(req.user, req.params.id)),
  reportAction: respond((req) =>
    work.reportAction(req.user, req.params.id, req.body),
  ),
  timesheet: respond((req) =>
    work.timesheet(req.user, req.body, req.params.id || null),
  ),
  allocation: respond((req) =>
    work.allocation(req.user, req.body, req.params.id || null),
  ),
  salary: respond((req) => finance.salary(req.user, req.body)),
  payrollDraft: respond((req) => finance.draft(req.user, req.body)),
  payrollAction: respond((req) =>
    finance.action(req.user, req.params.id, req.body),
  ),
  payslip: respond((req) => finance.payslip(req.user, req.params.id)),
  payroll: respond(async (req) => {
    const vals = [];
    const scope = c.scope(req.user, vals);
    const { page, limit } = c.page(req.query);
    const own = !c.can(req.user, "view_salary");
    vals.push(req.user.id);
    let where = `${scope}${own ? ` AND e.user_id=$${vals.length} AND p.status IN ('Approved','Posted')` : ""}`;
    if (!own) vals.pop();
    if(req.query.employeeId){vals.push(req.query.employeeId);where+=` AND e.id=$${vals.length}`;}
    const count = (
      await c.dbDefault.query(
        `SELECT count(*)::int AS total FROM hrm_payroll_entries pe JOIN hrm_payroll_runs p ON p.id=pe.run_id JOIN hrm_employees e ON e.id=pe.employee_id WHERE ${where}`,
        vals,
      )
    ).rows[0].total;
    vals.push(limit, (page - 1) * limit);
    const rows = (
      await c.dbDefault.query(
        `SELECT pe.id,pe.run_id,pe.employee_id,e.full_name AS employee_name,p.start_date,p.end_date,p.status,pe.gross,pe.deductions,pe.net,pe.currency FROM hrm_payroll_entries pe JOIN hrm_payroll_runs p ON p.id=pe.run_id JOIN hrm_employees e ON e.id=pe.employee_id WHERE ${where} ORDER BY p.created_at DESC,pe.id LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
        vals,
      )
    ).rows.map(c.camel);
    return { rows, total: count, page, limit };
  }),
  record: respond((req) =>
    lifecycle.record(
      req.user,
      req.params.kind,
      req.body,
      req.params.id || null,
    ),
  ),
  convert: respond((req) =>
    lifecycle.convertCandidate(req.user, req.params.id, req.body),
  ),
  offboard: respond((req) => lifecycle.offboard(req.user, req.params.id)),
  letter: respond((req) =>
    lifecycle.letter(req.user, req.params.id, req.query.templateId),
  ),
  uploadDocument: respond(
    (req) => lifecycle.uploadDocument(req.user, req.body, req.file),
    201,
  ),
  verifyDocument: respond((req) =>
    lifecycle.document(req.user, req.params.id, { verify: true }),
  ),
  downloadDocument: async (req, res, next) => {
    try {
      const r = await lifecycle.document(req.user, req.params.id);
      res.set({
        "Cache-Control": "no-store",
        "Content-Type": r.mimeType,
        "Content-Length": r.sizeBytes,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(r.fileName)}`,
      });
      res.send(r.content);
    } catch (e) {
      next(e);
    }
  },
  analytics: respond((req) => analytics.analytics(req.user, req.query)),
  dashboard: respond((req) => analytics.dashboard(req.user, req.query)),
  automation: respond((req) =>
    require("../services/hrm/automation").run(req.user),
  ),
  export: async (req, res, next) => {
    try {
      c.permit(req.user, "export");
      const allowed = [
        "employees",
        "attendance",
        "work-reports",
        "timesheets",
        "allocations",
        "requests",
        "documents",
        "salary-history",
      ];
      c.choice(req.params.kind, allowed, "Export");
      const page = { ...req.query, page: 1, limit: 100 };
      const result =
        req.params.kind === "employees"
          ? await employees.list(req.user, page)
          : await queries.list(req.user, req.params.kind, page);
      if (result.total > 10000)
        c.fail("Narrow the export filters to at most 10,000 rows");
      let rows = result.rows;
      for (let p = 2; p <= Math.ceil(result.total / 100); p++) {
        const q = { ...page, page: p };
        rows.push(
          ...(req.params.kind === "employees"
            ? await employees.list(req.user, q)
            : await queries.list(req.user, req.params.kind, q)
          ).rows,
        );
      }
      const keys = Object.keys(rows[0] || {}).filter(
        (k) => !["profile", "details", "components", "payload"].includes(k),
      );
      const escape = (v) => {
        let s = String(v ?? "");
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
        return `"${s.replace(/"/g, '""')}"`;
      };
      res.set({
        "Cache-Control": "no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hrm-${req.params.kind}.csv"`,
      });
      res.send(
        "\uFEFF" +
          [
            keys.join(","),
            ...rows.map((r) => keys.map((k) => escape(r[k])).join(",")),
          ].join("\r\n"),
      );
    } catch (e) {
      next(e);
    }
  },
};
module.exports = controller;
