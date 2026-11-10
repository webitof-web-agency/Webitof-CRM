// One request for the employee profile: the Overview cards and the counts beside each tab.
// Same HR scope as opening the profile; the activity list needs the audit permission.
const c = require("./core");

const ACTIVE_REQUEST = ["Submitted", "Manager Approved"];

async function summary(user, id, db = c.dbDefault) {
  const e = await c.employee(db, user, id);
  const p = await c.policy(db);
  const today = c.today(p);
  const monthStart = `${today.slice(0, 7)}-01`;
  const year = Number(today.slice(0, 4));

  const [todayRow, month, leave, requests, records, allocation, documents, reports, history, activity] =
    await Promise.all([
      db.query(
        "SELECT status,check_in,check_out,worked_minutes FROM hrm_attendance WHERE employee_id=$1 AND work_date=$2",
        [id, today],
      ),
      db.query(
        "SELECT status,count(*)::int AS n FROM hrm_attendance WHERE employee_id=$1 AND work_date BETWEEN $2 AND $3 GROUP BY status",
        [id, monthStart, today],
      ),
      db.query(
        `SELECT m.name,coalesce(sum(l.amount),0)::float AS balance
         FROM master_items m LEFT JOIN hrm_leave_ledger l ON l.leave_type_id=m.id AND l.employee_id=$1 AND l.year=$2
         WHERE m.type='hrm_leave_type' AND m.is_active=true GROUP BY m.id ORDER BY m.name`,
        [id, year],
      ),
      db.query(
        `SELECT kind,count(*)::int AS total,count(*) FILTER (WHERE status=ANY($2::text[]))::int AS pending
         FROM hrm_requests WHERE employee_id=$1 GROUP BY kind`,
        [id, ACTIVE_REQUEST],
      ),
      db.query(
        `SELECT kind,status,count(*)::int AS n FROM hrm_records
         WHERE employee_id=$1 AND archived_at IS NULL GROUP BY kind,status`,
        [id],
      ),
      db.query(
        `SELECT coalesce(sum(percent),0)::float AS percent,count(*)::int AS projects FROM hrm_allocations
         WHERE employee_id=$1 AND archived_at IS NULL AND start_date<=$2 AND end_date>=$2`,
        [id, today],
      ),
      db.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status='Pending')::int AS pending,
                count(*) FILTER (WHERE status='Rejected')::int AS rejected,
                count(*) FILTER (WHERE expires_on IS NOT NULL AND expires_on<=($2::date + 30))::int AS expiring
         FROM hrm_documents WHERE employee_id=$1 AND category<>'Profile Photo'`,
        [id, today],
      ),
      db.query(
        `SELECT count(*)::int AS total,count(*) FILTER (WHERE status='Submitted')::int AS pending
         FROM hrm_work_reports WHERE employee_id=$1 AND work_date BETWEEN $2 AND $3`,
        [id, monthStart, today],
      ),
      db.query("SELECT count(*)::int AS n FROM hrm_employment_history WHERE employee_id=$1", [id]),
      c.can(user, "audit")
        ? db.query(
            `SELECT a.action,a.entity,a.created_at,u.full_name AS actor FROM hrm_audit a
             LEFT JOIN users u ON u.id=a.actor_id WHERE a.employee_id=$1 ORDER BY a.created_at DESC LIMIT 6`,
            [id],
          )
        : null,
    ]);

  const byStatus = Object.fromEntries(month.rows.map((r) => [r.status, r.n]));
  const present = ["Present", "WFH", "Business Visit", "Half Day"].reduce((s, k) => s + (byStatus[k] || 0), 0);
  const requestBy = Object.fromEntries(requests.rows.map((r) => [r.kind, r]));
  const recordBy = {};
  for (const r of records.rows) {
    recordBy[r.kind] = recordBy[r.kind] || { total: 0, byStatus: {} };
    recordBy[r.kind].total += r.n;
    recordBy[r.kind].byStatus[r.status] = r.n;
  }
  const checklist = (kind) => {
    const r = recordBy[kind];
    return r ? { done: r.byStatus.Done || 0, total: r.total } : { done: 0, total: 0 };
  };
  const pendingRequests = requests.rows.reduce((s, r) => s + r.pending, 0);
  const t = todayRow.rows[0];
  const docs = documents.rows[0];
  const onboarding = checklist("onboarding");
  const offboarding = checklist("offboarding");
  const assets = recordBy.asset?.byStatus.Assigned || 0;

  // Tab key -> { count, attention }. attention marks something waiting for action.
  const badge = (count, attention = false) => (count ? { count, attention } : undefined);
  const badges = {
    documents: badge(docs.total, docs.pending + docs.rejected > 0),
    "work-reports": badge(reports.rows[0].pending, true),
    allocations: badge(allocation.rows[0].projects),
    leave: badge(requestBy.leave?.pending || 0, true),
    reimbursement: badge(requestBy.reimbursement?.pending || 0, true),
    goal: badge(recordBy.goal?.total || 0),
    review: badge(recordBy.review?.total || 0),
    skill: badge(recordBy.skill?.total || 0),
    asset: badge(assets),
    onboarding: badge(onboarding.total - onboarding.done, true),
    offboarding: badge(offboarding.total - offboarding.done, true),
    history: badge(history.rows[0].n),
  };

  return {
    today: t
      ? { status: t.status, checkIn: t.check_in, checkOut: t.check_out, workedMinutes: t.worked_minutes }
      : null,
    date: today,
    month: {
      present,
      absent: byStatus.Absent || 0,
      leave: byStatus.Leave || 0,
      halfDay: byStatus["Half Day"] || 0,
      marked: month.rows.reduce((s, r) => s + r.n, 0),
    },
    leave: {
      balance: leave.rows.reduce((s, r) => s + Number(r.balance), 0),
      types: leave.rows.map((r) => ({ name: r.name, balance: Number(r.balance) })),
    },
    pendingRequests,
    allocation: allocation.rows[0],
    assets,
    documents: docs,
    workReports: reports.rows[0],
    onboarding,
    offboarding,
    activity: activity
      ? activity.rows.map((r) => ({ action: r.action, entity: r.entity, at: r.created_at, actor: r.actor }))
      : null,
    badges: Object.fromEntries(Object.entries(badges).filter(([, v]) => v)),
  };
}

module.exports = { summary };
