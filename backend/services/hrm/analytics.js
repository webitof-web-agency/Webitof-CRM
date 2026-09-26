const c = require("./core");
const calc = require("./calculations");
async function analytics(user, q = {}, db = c.dbDefault) {
  const p = await c.policy(db);
  const { start, end } = c.range(q, p);
  const employees = await require("./employees").list(user, q, db);
  const ids = employees.rows.map((e) => e.id);
  if (!ids.length)
    return {
      ...employees,
      startDate: start,
      endDate: end,
      rows: [],
      policy: p,
    };
  const [a, w, l, h, m, x, alloc, salary, goals, reviews] = await Promise.all([
    db.query(
      "SELECT * FROM hrm_attendance WHERE employee_id=ANY($1::text[]) AND work_date BETWEEN $2 AND $3",
      [ids, start, end],
    ),
    db.query(
      `SELECT r.id AS report_id,r.employee_id,r.work_date,r.status,r.submitted_at,w.project_id,w.minutes,w.billable,w.blocker,w.task_id FROM hrm_work_reports r LEFT JOIN hrm_work_entries w ON w.report_id=r.id WHERE r.employee_id=ANY($1::text[]) AND r.work_date BETWEEN $2 AND $3`,
      [ids, start, end],
    ),
    db.query(
      "SELECT * FROM hrm_requests WHERE employee_id=ANY($1::text[]) AND kind='leave' AND status='Approved' AND start_date<=$3 AND end_date>=$2",
      [ids, start, end],
    ),
    db.query("SELECT * FROM hrm_holidays WHERE work_date BETWEEN $1 AND $2", [
      `${start.slice(0, 7)}-01`,
      require("./payroll").monthBounds(end).end,
    ]),
    db.query("SELECT * FROM master_items WHERE type='hrm_shift'"),
    db.query(
      "SELECT * FROM hrm_employment_history WHERE employee_id=ANY($1::text[]) AND effective_date<=$2",
      [ids, end],
    ),
    db.query(
      "SELECT * FROM hrm_allocations WHERE employee_id=ANY($1::text[]) AND start_date<=$3 AND end_date>=$2 AND archived_at IS NULL",
      [ids, start, end],
    ),
    c.can(user, "view_salary")
      ? db.query(
          "SELECT * FROM hrm_salary_history WHERE employee_id=ANY($1::text[]) AND effective_date<=$2",
          [ids, end],
        )
      : Promise.resolve({ rows: [] }),
    db.query(
      "SELECT * FROM hrm_records WHERE employee_id=ANY($1::text[]) AND kind='goal' AND archived_at IS NULL AND (start_date IS NULL OR start_date<=$3) AND (end_date IS NULL OR end_date>=$2)",
      [ids, start, end],
    ),
    db.query(
      "SELECT * FROM hrm_records WHERE employee_id=ANY($1::text[]) AND kind='review' AND status='Published' AND coalesce(end_date,created_at::date) BETWEEN $2 AND $3",
      [ids, start, end],
    ),
  ]);
  const rows = employees.rows.map((e) => {
    const relevant = (r) =>
      r.rows.map(c.camel).filter((i) => i.employeeId === e.id);
    const att = relevant(a),
      work = relevant(w),
      leaves = relevant(l),
      history = relevant(x),
      allocations = relevant(alloc);
    const context = {
      holidays: h.rows.map(c.camel),
      leave: leaves,
      masters: m.rows.map(c.camel),
      history,
    };
    const cal = calc.calendar(e, start, end, p, context);
    const available = cal.reduce((s, d) => s + d.hours, 0);
    const logged = work.filter(
      (w) => w.status !== "Draft" && w.status !== "Revision Requested",
    );
    const minutes = logged.reduce((s, w) => s + Number(w.minutes || 0), 0),
      billable = logged
        .filter((w) => w.billable)
        .reduce((s, w) => s + Number(w.minutes || 0), 0),
      productive = logged
        .filter((w) => w.projectId)
        .reduce((s, w) => s + Number(w.minutes || 0), 0);
    const now = c.today(p);
    const expected = cal.filter((d) => d.hours > 0 && d.date < now);
    const reportDates = new Set(logged.map((w) => w.workDate));
    const missing = expected.filter((d) => !reportDates.has(d.date));
    const submittedReports = [
      ...new Map(logged.map((w) => [w.reportId, w])).values(),
    ];
    const late = submittedReports.filter(
      (r) =>
        r.submittedAt &&
        Date.parse(r.submittedAt) >
          calc.localInstant(r.workDate, p.reportDeadline, p.timezone),
    ).length;
    const allocated = cal.reduce(
      (sum, d) =>
        sum +
        d.hours *
          allocations
            .filter((a) => a.startDate <= d.date && a.endDate >= d.date)
            .reduce((s, a) => s + Number(a.percent) / 100, 0),
      0,
    );
    const projectMap = new Map();
    for (const entry of logged) {
      const key = entry.projectId || "internal";
      const item = projectMap.get(key) || {
        projectId: entry.projectId,
        hours: 0,
        billableHours: 0,
      };
      item.hours += Number(entry.minutes || 0) / 60;
      item.billableHours += entry.billable
        ? Number(entry.minutes || 0) / 60
        : 0;
      projectMap.set(key, item);
    }
    const projects = [...projectMap.values()].map((v) => ({
      ...v,
      hours: calc.round(v.hours),
      billableHours: calc.round(v.billableHours),
      contribution: calc.rate(v.hours, minutes / 60),
    }));
    const reviewRows = relevant(reviews),
      goalRows = relevant(goals);
    const attendanceRate = calc.rate(
      att.filter(
        (a) =>
          a.checkIn && cal.some((d) => d.date === a.workDate && d.hours > 0),
      ).length,
      cal.filter((d) => d.hours > 0 && d.date <= now).length,
    );
    const result = {
      ...e,
      availableHours: calc.round(available),
      allocatedHours: calc.round(allocated),
      remainingCapacity: calc.round(available - allocated),
      loggedHours: calc.round(minutes / 60),
      billableHours: calc.round(billable / 60),
      nonBillableHours: calc.round((minutes - billable) / 60),
      productiveHours: calc.round(productive / 60),
      utilization: calc.utilization(productive / 60, available, p),
      billableUtilization: calc.rate(billable / 60, available),
      attendanceRate,
      lateCheckIns: att.filter((a) => a.lateMinutes > 0).length,
      earlyExits: att.filter((a) => a.earlyMinutes > 0).length,
      overtimeHours: calc.round(
        att.reduce((s, a) => s + Number(a.overtimeMinutes || 0), 0) / 60,
      ),
      missingReports: missing.length,
      missingDates: missing.map((x) => x.date),
      reportCompliance: calc.rate(
        expected.length - missing.length,
        expected.length,
      ),
      lateReports: late,
      projects,
      goals: goalRows.length,
      goalCompletion: calc.rate(
        goalRows.filter((g) => g.status === "Completed").length,
        goalRows.length,
      ),
      managerRating: reviewRows.length
        ? calc.round(
            reviewRows.reduce(
              (s, r) => s + Number(r.details.managerRating || 0),
              0,
            ) / reviewRows.length,
          )
        : null,
      calendar: cal.map((d) => {
        const r = work.find((r) => r.workDate === d.date);
        const dayMinutes = work
          .filter(
            (w) =>
              w.workDate === d.date &&
              w.status !== "Draft" &&
              w.status !== "Revision Requested",
          )
          .reduce((s, w) => s + Number(w.minutes || 0), 0);
        return {
          ...d,
          reportId: r?.reportId,
          status:
            d.hours === 0
              ? d.kind
              : !r || ["Draft", "Revision Requested"].includes(r.status)
                ? d.date < now
                  ? "Missing"
                  : "Awaiting report"
                : dayMinutes < Math.min(p.minimumReportHours, d.hours) * 60
                  ? "Low hours"
                  : r.status,
          loggedHours: calc.round(dayMinutes / 60),
        };
      }),
    };
    if (c.can(user, "view_salary")) {
      const hist = relevant(salary);
      let cost = 0;
      const uncosted = [];
      for (const entry of logged.filter(
        (w) => w.status === "Approved" && w.projectId,
      )) {
        const s = calc.effective(hist, entry.workDate);
        if (!s) {
          uncosted.push(entry.workDate);
          continue;
        }
        const bounds = require("./payroll").monthBounds(entry.workDate);
        const monthly = calc
          .calendar(
            { ...e, joiningDate: bounds.start, exitDate: null },
            bounds.start,
            bounds.end,
            p,
            { ...context, leave: [] },
          )
          .reduce((n, d) => n + d.hours, 0);
        const entryCost = monthly
          ? (Number(s.monthlyCost) * Number(entry.minutes || 0)) / 60 / monthly
          : 0;
        cost += entryCost;
        const project = projects.find((x) => x.projectId === entry.projectId);
        project.employeeCost = calc.round(
          (project.employeeCost || 0) + entryCost,
        );
      }
      result.cost = {
        approvedProjectCost: calc.round(cost),
        currency: p.currency,
        unpricedDates: [...new Set(uncosted)],
        basis:
          "Effective monthly employer cost / scheduled hours in that month × approved project hours",
      };
    }
    return result;
  });
  return { ...employees, rows, startDate: start, endDate: end, policy: p };
}
async function dashboard(user, q = {}, db = c.dbDefault) {
  const p = await c.policy(db);
  const { start, end } = c.range(q, p);
  const values = [];
  const parts = ["e.archived_at IS NULL", c.scope(user, values)];
  for (const key of [
    "departmentId",
    "managerId",
    "employmentTypeId",
    "workMode",
  ])
    if (q[key]) {
      values.push(q[key]);
      parts.push(`e.${c.snake(key)}=$${values.length}`);
    }
  if (q.employeeId) {
    values.push(q.employeeId);
    parts.push(`e.id=$${values.length}`);
  }
  if (q.projectId) {
    values.push(q.projectId);
    parts.push(
      `EXISTS(SELECT 1 FROM hrm_allocations a WHERE a.employee_id=e.id AND a.project_id=$${values.length} AND a.archived_at IS NULL)`,
    );
  }
  const where = parts.join(" AND ");
  const scoped = `SELECT e.id FROM hrm_employees e WHERE ${where}`;
  const headcount = (
    await db.query(
      `SELECT e.status,count(*)::int AS count FROM hrm_employees e WHERE ${where} GROUP BY e.status`,
      values,
    )
  ).rows;
  const departments = (
    await db.query(
      `SELECT coalesce(m.name,'Unassigned') AS name,count(*)::int AS count FROM hrm_employees e LEFT JOIN master_items m ON m.id=e.department_id WHERE ${where} GROUP BY m.name`,
      values,
    )
  ).rows;
  const today = c.today(p);
  const n = values.length;
  const [attendance, pending, trend] = await Promise.all([
    db.query(
      `SELECT status,count(*)::int AS count,count(*) FILTER(WHERE check_in IS NOT NULL AND check_out IS NULL)::int AS working FROM hrm_attendance WHERE employee_id IN(${scoped}) AND work_date=$${n + 1} GROUP BY status`,
      [...values, today],
    ),
    db.query(
      `SELECT kind,status,count(*)::int AS count FROM hrm_requests WHERE employee_id IN(${scoped}) AND status IN ('Submitted','Manager Approved') GROUP BY kind,status`,
      values,
    ),
    db.query(
      `SELECT r.work_date,coalesce(sum(w.minutes),0)::int AS minutes,coalesce(sum(w.minutes) FILTER(WHERE w.billable),0)::int AS billable_minutes,count(DISTINCT r.employee_id)::int AS reporters FROM hrm_work_reports r LEFT JOIN hrm_work_entries w ON w.report_id=r.id WHERE r.employee_id IN(${scoped}) AND r.work_date BETWEEN $${n + 1} AND $${n + 2} AND r.status IN ('Submitted','Reviewed','Approved') GROUP BY r.work_date ORDER BY r.work_date`,
      [...values, start, end],
    ),
  ]);
  return {
    startDate: start,
    endDate: end,
    today,
    headcount,
    departments,
    attendance: attendance.rows,
    pending: pending.rows,
    trend: trend.rows.map(c.camel),
    totalEmployees: headcount.reduce((s, x) => s + x.count, 0),
  };
}
module.exports = { analytics, dashboard };
