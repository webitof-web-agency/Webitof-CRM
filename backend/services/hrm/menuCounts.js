// Pending work per HRM sub-menu (GET /hrm/menu-counts), shown as number dots in the sidebar.
// Keys are sidebar paths; a key is present only when the user may act on that list, so the
// sidebar falls back to unread-notification counts for everything else. The counting rules match
// the HRM overview ("Waiting for your approval", "Alerts") so the numbers agree with that page.
const c = require("./core");

const PENDING = ["Submitted", "Manager Approved"];
const OPEN_ALERT = ["Open", "Explanation Requested", "Explained"];
const REQUEST_PATHS = {
  leave: "/app/hrm/leave",
  regularization: "/app/hrm/regularization",
  reimbursement: "/app/hrm/reimbursement",
  resignation: "/app/hrm/resignation",
  helpdesk: "/app/hrm/helpdesk",
};

function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function count(db, sql, values) {
  try {
    return (await db.query(sql, values)).rows[0]?.n || 0;
  } catch (error) {
    // One failing count (e.g. an optional table) must not hide the others.
    console.error("HRM menu count failed:", error.message);
    return 0;
  }
}

async function menuCounts(user, db = c.dbDefault) {
  const p = await c.policy(db);
  const today = c.today(p);
  const values = [];
  const where = `e.archived_at IS NULL AND ${c.scope(user, values)}`;
  const n = values.length;
  const approver = c.can(user, "approve") || c.can(user, "hr_approve");
  const counts = {};
  const jobs = [];
  const add = (key, promise) => jobs.push(promise.then((value) => (counts[key] = value)));

  if (approver || c.can(user, "finance")) {
    // Requests waiting for a decision, by kind (own requests are excluded, as on the overview).
    jobs.push(
      db
        .query(
          `SELECT r.kind, count(*)::int AS n FROM hrm_requests r JOIN hrm_employees e ON e.id = r.employee_id
            WHERE ${where} AND r.status = ANY($${n + 1}::text[]) AND e.user_id IS DISTINCT FROM $${n + 2}
            GROUP BY r.kind`,
          [...values, PENDING, user.id],
        )
        .then(({ rows }) => {
          Object.values(REQUEST_PATHS).forEach((path) => (counts[path] = 0));
          rows.forEach((r) => REQUEST_PATHS[r.kind] && (counts[REQUEST_PATHS[r.kind]] = r.n));
          counts.approvals = rows.reduce((sum, r) => sum + r.n, 0);
        })
        .catch((error) => console.error("HRM menu count failed:", error.message)),
    );
  }
  if (approver) {
    add(
      "alerts",
      count(
        db,
        `SELECT count(*)::int AS n FROM hrm_alerts al JOIN hrm_employees e ON e.id = al.employee_id
          WHERE ${where} AND al.status = ANY($${n + 1}::text[]) AND al.work_date >= $${n + 2}::date
            AND e.user_id IS DISTINCT FROM $${n + 3}`,
        [...values, OPEN_ALERT, addDays(today, -6), user.id],
      ),
    );
    add("/app/hrm/work-reports", count(db, `SELECT count(*)::int AS n FROM hrm_work_reports w JOIN hrm_employees e ON e.id = w.employee_id WHERE ${where} AND w.status = 'Submitted'`, values));
    add("/app/hrm/timesheets", count(db, `SELECT count(*)::int AS n FROM hrm_timesheets t JOIN hrm_employees e ON e.id = t.employee_id WHERE ${where} AND t.status = 'Submitted'`, values));
    add(
      "/app/hrm/geofences",
      count(db, `SELECT count(*)::int AS n FROM hrm_geofences g JOIN hrm_employees e ON e.id = g.employee_id WHERE ${where} AND g.kind = 'home' AND g.status = 'Pending'`, values),
    );
  }
  if (c.can(user, "documents") || c.can(user, "manage_employees"))
    add("/app/hrm/documents", count(db, `SELECT count(*)::int AS n FROM hrm_documents d JOIN hrm_employees e ON e.id = d.employee_id WHERE ${where} AND d.status = 'Pending'`, values));
  if (c.can(user, "manage_employees")) {
    for (const kind of ["onboarding", "offboarding"])
      add(
        `/app/hrm/${kind}`,
        count(db, `SELECT count(*)::int AS n FROM hrm_records r JOIN hrm_employees e ON e.id = r.employee_id WHERE ${where} AND r.kind = $${n + 1} AND r.status IN ('Pending','In Progress') AND r.archived_at IS NULL`, [...values, kind]),
      );
  }
  if (c.can(user, "payroll")) {
    add("/app/hrm/payroll", count(db, "SELECT count(*)::int AS n FROM hrm_payroll_runs WHERE status IN ('Draft','Reviewed')", []));
    add("/app/hrm/payroll_adjustment", count(db, "SELECT count(*)::int AS n FROM hrm_records WHERE kind = 'payroll_adjustment' AND status = 'Draft' AND archived_at IS NULL", []));
  }
  if (c.can(user, "recruitment")) {
    add("/app/hrm/candidate", count(db, "SELECT count(*)::int AS n FROM hrm_records WHERE kind = 'candidate' AND status = 'Applicant' AND archived_at IS NULL", []));
    add(
      "/app/hrm/interview",
      count(
        db,
        `SELECT count(*)::int AS n FROM hrm_records WHERE kind = 'interview' AND status = 'Scheduled' AND archived_at IS NULL
          AND left(coalesce(details->>'scheduledAt', ''), 10) BETWEEN $1 AND $2`,
        [today, addDays(today, 1)],
      ),
    );
  }
  if (c.can(user, "performance"))
    add("/app/hrm/review", count(db, `SELECT count(*)::int AS n FROM hrm_records r JOIN hrm_employees e ON e.id = r.employee_id WHERE ${where} AND r.kind = 'review' AND r.status = 'Manager Review' AND r.archived_at IS NULL`, values));
  // The employee's own to-do: alerts HR asked them to explain.
  add(
    "/app/hrm/my-day",
    count(db, "SELECT count(*)::int AS n FROM hrm_alerts al JOIN hrm_employees e ON e.id = al.employee_id WHERE e.user_id = $1 AND al.status = 'Explanation Requested'", [user.id]),
  );
  await Promise.all(jobs);

  // Overview shows the approval queue and the alerts; the HRM parent counts every item once.
  if (counts.approvals != null || counts.alerts != null) counts["/app/hrm/overview"] = (counts.approvals || 0) + (counts.alerts || 0);
  const { approvals = 0, alerts = 0 } = counts;
  delete counts.approvals;
  delete counts.alerts;
  const listed = Object.entries(counts)
    .filter(([path]) => path !== "/app/hrm/overview" && !Object.values(REQUEST_PATHS).includes(path))
    .reduce((sum, [, value]) => sum + value, 0);
  counts["/app/hrm"] = approvals + alerts + listed;
  return counts;
}

module.exports = { menuCounts };
