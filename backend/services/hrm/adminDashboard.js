// Admin / manager HRM dashboard (GET /hrm/dashboard/overview). Everything is limited to the
// employees the user may see (c.scope) and to the permission each block needs. Each block is
// built on its own: one that fails comes back as { error } and the rest still loads.
const c = require("./core");
const analytics = require("./analytics");
const { RECORDS } = require("../../config/hrmRecords");

const ACTIVE = ["Active", "Probation", "Confirmed", "Notice Period"];
const PENDING = ["Submitted", "Manager Approved"];
const OPEN_ALERT = ["Open", "Explanation Requested", "Explained"];

async function block(name, run) {
  try {
    return await run();
  } catch (error) {
    console.error(`HRM dashboard block ${name} failed:`, error.message);
    return { error: "Could not load" };
  }
}

function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function minutesOf(hhmm) {
  const [h, m] = String(hhmm || "09:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function nowMinutes(timezone) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  return minutesOf(parts);
}

// Scoped employee filter as SQL, with its values (alias e).
function scoped(user) {
  const values = [];
  const where = `e.archived_at IS NULL AND ${c.scope(user, values)}`;
  return { values, where };
}

async function todayBoard(db, user, p, today) {
  const { values, where } = scoped(user);
  const n = values.length;
  const rows = (
    await db.query(
      `SELECT e.id, e.full_name, e.employee_number, e.work_mode AS default_mode, d.name AS department,
              a.status, a.check_in, a.check_out, a.late_minutes, a.work_mode,
              a.lunch_started_at, a.lunch_ended_at, a.job_started_at, a.job_ended_at,
              (SELECT r.title FROM hrm_requests r WHERE r.employee_id = e.id AND r.kind = 'leave' AND r.status = 'Approved'
                 AND r.start_date <= $${n + 1}::date AND coalesce(r.end_date, r.start_date) >= $${n + 1}::date LIMIT 1) AS leave_title,
              (SELECT count(*)::int FROM hrm_alerts al WHERE al.employee_id = e.id AND al.work_date = $${n + 1}::date AND al.status <> 'Resolved') AS open_alerts
         FROM hrm_employees e
         LEFT JOIN master_items d ON d.id = e.department_id
         LEFT JOIN hrm_attendance a ON a.employee_id = e.id AND a.work_date = $${n + 1}::date
        WHERE ${where} AND e.status = ANY($${n + 2}::text[])
        ORDER BY e.full_name
        LIMIT 1000`,
      [...values, today, ACTIVE],
    )
  ).rows;
  const shiftStarted = nowMinutes(p.timezone) > minutesOf(p.shiftStart) + Number(p.graceMinutes || 0);
  const people = rows.map((r) => {
    const open = Boolean(r.check_in && !r.check_out);
    let state;
    if (r.leave_title || r.status === "Leave") state = "leave";
    else if (r.status === "Absent" && !r.check_in) state = "absent";
    else if (!r.check_in) state = shiftStarted ? "notIn" : "notYet";
    else if (r.check_out) state = "out";
    else if (r.lunch_started_at && !r.lunch_ended_at) state = "lunch";
    else state = "working";
    return {
      employeeId: r.id,
      name: r.full_name,
      number: r.employee_number,
      department: r.department || "Unassigned",
      state,
      open,
      late: Number(r.late_minutes || 0) > 0 || r.status === "Late",
      lateMinutes: Number(r.late_minutes || 0),
      mode: r.work_mode || null,
      checkIn: r.check_in,
      checkOut: r.check_out,
      leave: r.leave_title || null,
      alerts: r.open_alerts || 0,
    };
  });
  const pick = (test) => people.filter(test);
  const present = pick((x) => x.checkIn);
  const groups = {
    present: present,
    late: pick((x) => x.late),
    working: pick((x) => x.state === "working"),
    lunch: pick((x) => x.state === "lunch"),
    remote: pick((x) => x.checkIn && x.mode && !["WFO", "Office"].includes(x.mode)),
    leave: pick((x) => x.state === "leave"),
    absent: pick((x) => x.state === "absent"),
    notIn: pick((x) => x.state === "notIn"),
    out: pick((x) => x.state === "out"),
  };
  // Attendance % per department: present (any check-in) out of those expected (not on leave).
  const byDept = new Map();
  for (const x of people) {
    const row = byDept.get(x.department) || { department: x.department, expected: 0, present: 0, late: 0 };
    if (x.state !== "leave") row.expected += 1;
    if (x.checkIn) row.present += 1;
    if (x.late) row.late += 1;
    byDept.set(x.department, row);
  }
  return {
    date: today,
    shiftStart: p.shiftStart,
    shiftStarted,
    total: people.length,
    counts: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
    groups: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.slice(0, 60)])),
    departments: [...byDept.values()].sort((a, b) => b.expected - a.expected),
  };
}

function canActOn(user, r) {
  if (r.status === "Manager Approved") return c.can(user, r.kind === "reimbursement" ? "finance" : "hr_approve");
  return c.can(user, "approve");
}

async function approvals(db, user) {
  const { values, where } = scoped(user);
  const n = values.length;
  const rows = (
    await db.query(
      `SELECT r.id, r.kind, r.title, r.status, r.start_date, r.end_date, r.details, r.created_at, r.version,
              e.id AS employee_id, e.full_name, e.user_id
         FROM hrm_requests r JOIN hrm_employees e ON e.id = r.employee_id
        WHERE ${where} AND r.status = ANY($${n + 1}::text[])
        ORDER BY r.created_at ASC
        LIMIT 60`,
      [...values, PENDING],
    )
  ).rows;
  const items = rows
    .filter((r) => r.user_id !== user.id)
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      status: r.status,
      startDate: r.start_date,
      endDate: r.end_date,
      days: r.details?.days ?? null,
      halfDay: Boolean(r.details?.halfDay),
      amount: r.details?.amount ?? null,
      reason: r.details?.reason || r.details?.note || "",
      createdAt: r.created_at,
      employeeId: r.employee_id,
      employee: r.full_name,
      canAct: canActOn(user, r),
    }));
  const [reports, timesheets] = await Promise.all([
    db.query(
      `SELECT count(*)::int AS n FROM hrm_work_reports w JOIN hrm_employees e ON e.id = w.employee_id WHERE ${where} AND w.status = 'Submitted'`,
      values,
    ),
    db.query(
      `SELECT count(*)::int AS n FROM hrm_timesheets t JOIN hrm_employees e ON e.id = t.employee_id WHERE ${where} AND t.status = 'Submitted'`,
      values,
    ).catch(() => ({ rows: [{ n: 0 }] })),
  ]);
  return {
    items,
    total: items.length,
    workReports: reports.rows[0]?.n || 0,
    timesheets: timesheets.rows[0]?.n || 0,
  };
}

async function alerts(db, user, today) {
  const { values, where } = scoped(user);
  const n = values.length;
  const rows = (
    await db.query(
      `SELECT al.id, al.kind, al.status, al.title, al.work_date, al.opened_at, al.explanation,
              e.id AS employee_id, e.full_name, e.user_id
         FROM hrm_alerts al JOIN hrm_employees e ON e.id = al.employee_id
        WHERE ${where} AND al.status = ANY($${n + 1}::text[]) AND al.work_date >= $${n + 2}::date
        ORDER BY (al.status = 'Explained') DESC, al.opened_at DESC
        LIMIT 30`,
      [...values, OPEN_ALERT, addDays(today, -6)],
    )
  ).rows;
  const canAct = c.can(user, "approve") || c.can(user, "hr_approve");
  return {
    total: rows.length,
    canAct,
    canOverride: c.can(user, "hr_approve"),
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      status: r.status,
      title: r.title,
      workDate: r.work_date,
      openedAt: r.opened_at,
      explanation: r.explanation,
      employeeId: r.employee_id,
      employee: r.full_name,
      own: r.user_id === user.id,
    })),
  };
}

async function away(db, user, today) {
  const { values, where } = scoped(user);
  const n = values.length;
  const until = addDays(today, 6);
  const [leaves, holidays] = await Promise.all([
    db.query(
      `SELECT r.id, r.title, r.start_date, coalesce(r.end_date, r.start_date) AS end_date, r.details, e.id AS employee_id, e.full_name
         FROM hrm_requests r JOIN hrm_employees e ON e.id = r.employee_id
        WHERE ${where} AND r.kind = 'leave' AND r.status = 'Approved'
          AND r.start_date <= $${n + 2}::date AND coalesce(r.end_date, r.start_date) >= $${n + 1}::date
        ORDER BY r.start_date, e.full_name
        LIMIT 40`,
      [...values, today, until],
    ),
    db.query("SELECT name, work_date, optional FROM hrm_holidays WHERE work_date >= $1::date ORDER BY work_date LIMIT 4", [today]),
  ]);
  const rows = leaves.rows.map((r) => ({
    id: r.id,
    employeeId: r.employee_id,
    employee: r.full_name,
    title: r.title,
    startDate: r.start_date,
    endDate: r.end_date,
    halfDay: Boolean(r.details?.halfDay),
    today: String(r.start_date) <= today && String(r.end_date) >= today,
  }));
  return {
    today: rows.filter((r) => r.today),
    week: rows,
    holidays: holidays.rows.map((h) => ({ name: h.name, date: h.work_date, optional: Boolean(h.optional) })),
  };
}

// Day-of-year distance from today (0..days), ignoring the year; null when out of range.
function daysUntilYearly(dateValue, today, days) {
  if (!dateValue) return null;
  const md = String(dateValue).slice(5, 10);
  if (!/^\d{2}-\d{2}$/.test(md)) return null;
  for (let i = 0; i <= days; i += 1) if (addDays(today, i).slice(5, 10) === md) return i;
  return null;
}

async function upcoming(db, user, today) {
  const { values, where } = scoped(user);
  const n = values.length;
  const employees = (
    await db.query(
      `SELECT e.id, e.full_name, e.joining_date, e.probation_end, e.contract_end, e.exit_date, e.status,
              pp.details->>'dob' AS dob
         FROM hrm_employees e LEFT JOIN hrm_private_profiles pp ON pp.employee_id = e.id
        WHERE ${where} AND e.status <> ALL($${n + 1}::text[])`,
      [...values, ["Relieved", "Terminated", "Inactive", "Draft"]],
    )
  ).rows;
  const events = [];
  for (const e of employees) {
    const birthday = daysUntilYearly(e.dob, today, 7);
    if (birthday != null) events.push({ type: "birthday", in: birthday, employeeId: e.id, employee: e.full_name, date: addDays(today, birthday) });
    const anniversary = daysUntilYearly(e.joining_date && String(e.joining_date).slice(0, 10), today, 7);
    const years = e.joining_date ? Number(today.slice(0, 4)) - Number(String(e.joining_date).slice(0, 4)) : 0;
    if (anniversary != null && years >= 1)
      events.push({ type: "anniversary", in: anniversary, years, employeeId: e.id, employee: e.full_name, date: addDays(today, anniversary) });
    for (const [type, value, window] of [
      ["probation", e.probation_end, 14],
      ["contract", e.contract_end, 30],
      ["exit", e.exit_date, 30],
    ]) {
      if (!value) continue;
      const day = String(value instanceof Date ? value.toISOString() : value).slice(0, 10);
      if (day >= today && day <= addDays(today, window))
        events.push({ type, in: Math.round((Date.parse(day) - Date.parse(today)) / 86400000), employeeId: e.id, employee: e.full_name, date: day });
    }
  }
  const docs = (
    await db.query(
      `SELECT dc.id, dc.title, dc.category, dc.expires_on, e.id AS employee_id, e.full_name
         FROM hrm_documents dc JOIN hrm_employees e ON e.id = dc.employee_id
        WHERE ${where} AND dc.expires_on IS NOT NULL AND dc.expires_on <= $${n + 1}::date AND dc.expires_on >= $${n + 2}::date
        ORDER BY dc.expires_on LIMIT 30`,
      [...values, addDays(today, 30), addDays(today, -30)],
    )
  ).rows;
  for (const d of docs) {
    const day = String(d.expires_on instanceof Date ? d.expires_on.toISOString() : d.expires_on).slice(0, 10);
    events.push({
      type: "document",
      in: Math.round((Date.parse(day) - Date.parse(today)) / 86400000),
      employeeId: d.employee_id,
      employee: d.full_name,
      date: day,
      title: d.title || d.category,
    });
  }
  events.sort((a, b) => a.in - b.in || a.employee.localeCompare(b.employee));
  let lifecycle = null;
  if (c.can(user, "manage_employees")) {
    const r = await db.query(
      `SELECT k.kind, count(*)::int AS n FROM hrm_records k JOIN hrm_employees e ON e.id = k.employee_id
        WHERE ${where} AND k.kind IN ('onboarding','offboarding') AND k.archived_at IS NULL AND k.status <> 'Done'
        GROUP BY k.kind`,
      values,
    );
    lifecycle = Object.fromEntries(r.rows.map((x) => [x.kind, x.n]));
  }
  return { events: events.slice(0, 40), lifecycle };
}

async function productivity(db, user, today, base) {
  const { values, where } = scoped(user);
  const n = values.length;
  const reports = (
    await db.query(
      `SELECT count(*) FILTER (WHERE a.check_in IS NOT NULL)::int AS expected,
              count(w.id) FILTER (WHERE w.status IN ('Submitted','Reviewed','Approved'))::int AS submitted
         FROM hrm_employees e
         LEFT JOIN hrm_attendance a ON a.employee_id = e.id AND a.work_date = $${n + 1}::date
         LEFT JOIN hrm_work_reports w ON w.employee_id = e.id AND w.work_date = $${n + 1}::date
        WHERE ${where}`,
      [...values, today],
    )
  ).rows[0];
  const missed = (
    await db.query(
      `SELECT count(*)::int AS n FROM hrm_attendance_events ev JOIN hrm_attendance a ON a.id = ev.attendance_id
         JOIN hrm_employees e ON e.id = a.employee_id
        WHERE ${where} AND a.work_date = $${n + 1}::date AND ev.kind = 'slot_missed'`,
      [...values, today],
    )
  ).rows[0];
  const lateTrend = (
    await db.query(
      `SELECT a.work_date, count(*) FILTER (WHERE a.late_minutes > 0 OR a.status = 'Late')::int AS late,
              count(*) FILTER (WHERE a.check_in IS NOT NULL)::int AS present
         FROM hrm_attendance a JOIN hrm_employees e ON e.id = a.employee_id
        WHERE ${where} AND a.work_date BETWEEN $${n + 1}::date AND $${n + 2}::date
        GROUP BY a.work_date ORDER BY a.work_date`,
      [...values, addDays(today, -13), today],
    )
  ).rows.map((r) => ({ date: String(r.work_date instanceof Date ? r.work_date.toISOString() : r.work_date).slice(0, 10), late: r.late, present: r.present }));
  const trend = Array.isArray(base?.trend) ? base.trend : [];
  const minutes = trend.reduce((s, x) => s + Number(x.minutes || 0), 0);
  const billable = trend.reduce((s, x) => s + Number(x.billableMinutes || 0), 0);
  const reporterDays = trend.reduce((s, x) => s + Number(x.reporters || 0), 0);
  return {
    reportsExpected: reports?.expected || 0,
    reportsSubmitted: reports?.submitted || 0,
    slotsMissed: missed?.n || 0,
    avgHoursPerDay: reporterDays ? Math.round((minutes / reporterDays / 60) * 10) / 10 : 0,
    billablePercent: minutes ? Math.round((billable / minutes) * 100) : 0,
    lateTrend,
  };
}

async function utilization(db, user, today) {
  const { values, where } = scoped(user);
  const n = values.length;
  const rows = (
    await db.query(
      `SELECT e.id, e.full_name, coalesce(sum(al.percent), 0)::numeric AS percent, count(al.id)::int AS projects
         FROM hrm_employees e
         LEFT JOIN hrm_allocations al ON al.employee_id = e.id AND al.archived_at IS NULL
              AND al.start_date <= $${n + 1}::date AND al.end_date >= $${n + 1}::date
        WHERE ${where} AND e.status = ANY($${n + 2}::text[])
        GROUP BY e.id, e.full_name`,
      [...values, today, ACTIVE],
    )
  ).rows.map((r) => ({ employeeId: r.id, employee: r.full_name, percent: Number(r.percent), projects: r.projects }));
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + Math.min(r.percent, 100), 0) / rows.length) : 0;
  return {
    average: avg,
    bench: rows.filter((r) => r.percent === 0).sort((a, b) => a.employee.localeCompare(b.employee)).slice(0, 20),
    benchCount: rows.filter((r) => r.percent === 0).length,
    over: rows.filter((r) => r.percent > 100).sort((a, b) => b.percent - a.percent).slice(0, 20),
    total: rows.length,
  };
}

async function movement(db, user, today) {
  const { values, where } = scoped(user);
  const n = values.length;
  const monthStart = `${today.slice(0, 7)}-01`;
  const rows = (
    await db.query(
      `SELECT e.id, e.full_name, e.joining_date, e.exit_date, d.name AS department
         FROM hrm_employees e LEFT JOIN master_items d ON d.id = e.department_id
        WHERE ${where} AND (e.joining_date BETWEEN $${n + 1}::date AND $${n + 2}::date OR e.exit_date BETWEEN $${n + 1}::date AND $${n + 2}::date)
        ORDER BY coalesce(e.exit_date, e.joining_date) DESC LIMIT 40`,
      [...values, monthStart, today],
    )
  ).rows;
  const day = (v) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : null);
  const joined = rows.filter((r) => day(r.joining_date) >= monthStart && day(r.joining_date) <= today);
  const exited = rows.filter((r) => r.exit_date && day(r.exit_date) >= monthStart && day(r.exit_date) <= today);
  const map = (r, field) => ({ employeeId: r.id, employee: r.full_name, department: r.department, date: day(r[field]) });
  return { from: monthStart, joined: joined.map((r) => map(r, "joining_date")), exited: exited.map((r) => map(r, "exit_date")) };
}

async function payroll(db, user, today) {
  const monthStart = `${today.slice(0, 7)}-01`;
  const run = (
    await db.query(
      `SELECT id, start_date, end_date, status, approved_at FROM hrm_payroll_runs
        WHERE start_date <= $1::date AND end_date >= $2::date ORDER BY created_at DESC LIMIT 1`,
      [today, monthStart],
    )
  ).rows[0];
  const last = run
    ? null
    : (await db.query("SELECT id, start_date, end_date, status FROM hrm_payroll_runs ORDER BY end_date DESC LIMIT 1")).rows[0];
  const { values, where } = scoped(user);
  const n = values.length;
  const reimb = (
    await db.query(
      `SELECT count(*)::int AS n, coalesce(sum(nullif(r.details->>'amount','')::numeric), 0)::numeric AS amount
         FROM hrm_requests r JOIN hrm_employees e ON e.id = r.employee_id
        WHERE ${where} AND r.kind = 'reimbursement' AND r.status = ANY($${n + 1}::text[])`,
      [...values, PENDING],
    )
  ).rows[0];
  const shape = (r) => (r ? { id: r.id, startDate: r.start_date, endDate: r.end_date, status: r.status } : null);
  return {
    current: shape(run),
    last: shape(last),
    reimbursements: { pending: reimb?.n || 0, amount: Number(reimb?.amount || 0) },
  };
}

async function recruitment(db, today) {
  const [jobs, candidates, interviews] = await Promise.all([
    db.query("SELECT count(*)::int AS n FROM hrm_records WHERE kind = 'job' AND status = 'Open' AND archived_at IS NULL"),
    db.query("SELECT status, count(*)::int AS n FROM hrm_records WHERE kind = 'candidate' AND archived_at IS NULL GROUP BY status"),
    db.query(
      `SELECT i.id, i.title, i.status, i.details->>'scheduledAt' AS at, i.details->>'interviewer' AS interviewer, k.title AS candidate
         FROM hrm_records i LEFT JOIN hrm_records k ON k.id = i.parent_id
        WHERE i.kind = 'interview' AND i.archived_at IS NULL AND i.status = 'Scheduled'
          AND left(coalesce(i.details->>'scheduledAt', ''), 10) BETWEEN $1 AND $2
        ORDER BY i.details->>'scheduledAt' LIMIT 10`,
      [today, addDays(today, 1)],
    ),
  ]);
  const byStage = Object.fromEntries(candidates.rows.map((r) => [r.status, r.n]));
  return {
    openJobs: jobs.rows[0]?.n || 0,
    stages: RECORDS.candidate.statuses.filter((s) => !["Joined", "Rejected"].includes(s)).map((s) => ({ stage: s, count: byStage[s] || 0 })),
    inPipeline: RECORDS.candidate.statuses.filter((s) => !["Joined", "Rejected"].includes(s)).reduce((sum, s) => sum + (byStage[s] || 0), 0),
    interviews: interviews.rows.map((r) => ({ id: r.id, candidate: r.candidate || r.title, at: r.at, interviewer: r.interviewer, status: r.status })),
  };
}

async function overview(user, q = {}, db = c.dbDefault) {
  c.permit(user, "approve", "hr_approve", "view_team", "view_all", "view_projects");
  const p = await c.policy(db);
  const today = c.today(p);
  const base = await analytics.dashboard(user, q, db);
  const [board, queue, alertList, absent, dates, work, util, moves, pay, hiring] = await Promise.all([
    block("today", () => todayBoard(db, user, p, today)),
    c.can(user, "approve") || c.can(user, "hr_approve") || c.can(user, "finance") ? block("approvals", () => approvals(db, user)) : null,
    block("alerts", () => alerts(db, user, today)),
    block("away", () => away(db, user, today)),
    block("upcoming", () => upcoming(db, user, today)),
    block("productivity", () => productivity(db, user, today, base)),
    block("utilization", () => utilization(db, user, today)),
    block("movement", () => movement(db, user, today)),
    c.can(user, "view_salary") || c.can(user, "payroll") || c.can(user, "finance") ? block("payroll", () => payroll(db, user, today)) : null,
    c.can(user, "recruitment") ? block("recruitment", () => recruitment(db, today)) : null,
  ]);
  return {
    ...base,
    today,
    timezone: p.timezone,
    board,
    approvals: queue,
    alerts: alertList,
    away: absent,
    upcoming: dates,
    productivity: work,
    utilization: util,
    movement: moves,
    payroll: pay,
    recruitment: hiring,
  };
}

module.exports = { overview, _private: { daysUntilYearly, addDays } };
