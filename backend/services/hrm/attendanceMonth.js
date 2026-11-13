// One calendar month of attendance per employee, for the "My attendance" calendar and the
// attendance chart (employees x days). Read-only.
//
// Each day gets a short code:
//   P present (also WFH / client visit)   A absent (or nothing recorded on a past working day)
//   HD half day   L / L½ leave   MP missing punch (clocked in, never out)   H holiday
//   WO weekly off   SW worked on a weekly off or holiday   CO comp off   null: nothing yet / future
// and flags: late, early checkout, after shift (overtime) and punch error (auto clock-out or MP).
const c = require("./core");
const calc = require("./calculations");
const { calendarData } = require("./operations");

const PRESENT = ["Present", "WFH", "Business Visit", "Client Visit"];

function monthRange(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) c.fail("Month must look like 2026-11");
  const start = `${m[1]}-${m[2]}-01`;
  const end = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).toISOString().slice(0, 10);
  return { start, end };
}

function employeeIdList(raw) {
  const list = (Array.isArray(raw) ? raw : String(raw || "").split(","))
    .map((v) => String(v).trim())
    .filter(Boolean);
  if (list.length > 500) c.fail("Pick at most 500 employees");
  return [...new Set(list)];
}

const minutes = (v) => (v == null ? 0 : Math.max(0, Number(v) || 0));

// The shift for the day: the snapshot taken at clock-in, else the employee's shift, else policy.
// `shift` may be a plain name (older callers) or { name, start, end, breakMinutes }.
function shiftFor(att, shift) {
  const fallback = typeof shift === "string" ? { name: shift } : shift || {};
  const snap = att?.shiftSnapshot && Object.keys(att.shiftSnapshot).length ? att.shiftSnapshot : null;
  return {
    name: snap?.name || fallback.name || null,
    start: snap?.start || fallback.start || null,
    end: snap?.end || fallback.end || null,
    breakMinutes: minutes(snap?.breakMinutes ?? fallback.breakMinutes),
  };
}

function dayCell(d, att, leaves, today, shift) {
  const s = shiftFor(att, shift);
  const base = {
    date: d.date,
    kind: d.kind,
    code: null,
    status: att?.status || null,
    checkIn: att?.checkIn || null,
    checkOut: att?.checkOut || null,
    workedMinutes: minutes(att?.workedMinutes),
    lateMinutes: minutes(att?.lateMinutes),
    earlyMinutes: minutes(att?.earlyMinutes),
    overtimeMinutes: minutes(att?.overtimeMinutes),
    workMode: att?.workMode || null,
    shift: s.name,
    shiftStart: s.start,
    shiftEnd: s.end,
    // Lunch from the employee app; the shift's break is the allowance.
    lunchStart: att?.lunchStartedAt || null,
    lunchEnd: att?.lunchEndedAt || null,
    lunchMinutes: minutes(att?.lunchMinutes),
    lunchAllowance: s.breakMinutes,
    leave: null,
    unmarked: false,
    live: false,
  };
  if (d.kind === "Outside employment") return base;
  const fullLeave = leaves.find((l) => Number(l.details?.fraction || 1) >= 1);
  const halfLeave = leaves.find((l) => Number(l.details?.fraction || 1) < 1);
  if (leaves.length) base.leave = { fraction: fullLeave ? 1 : 0.5, paid: (fullLeave || halfLeave).details?.paid !== false };
  const worked = Boolean(att?.checkIn);
  const open = worked && !att.checkOut;
  if (d.kind === "Holiday" || d.kind === "Week off") {
    base.code = worked ? "SW" : d.kind === "Holiday" ? "H" : "WO";
  } else if (att?.status === "Absent") base.code = "A";
  else if (att?.status === "Half Day") base.code = "HD";
  else if (att?.status === "Holiday") base.code = "H";
  else if (att?.status === "Week Off") base.code = "WO";
  else if (att?.status === "Comp Off") base.code = "CO";
  else if (fullLeave || att?.status === "Leave") base.code = "L";
  else if (open && d.date < today) base.code = "MP";
  else if (worked || PRESENT.includes(att?.status)) base.code = halfLeave ? "HD" : "P";
  else if (halfLeave) base.code = "L½";
  else if (d.date < today) {
    base.code = "A";
    base.unmarked = true;
  }
  base.live = open && d.date === today;
  base.late = base.lateMinutes > 0;
  base.early = base.earlyMinutes > 0;
  base.afterShift = base.overtimeMinutes > 0;
  base.punchError = Boolean(att?.autoCheckoutAt) || base.code === "MP";
  return base;
}

function totals(days, today) {
  const t = { present: 0, absent: 0, leave: 0, halfDays: 0, holidays: 0, weekOffs: 0, offDayWorked: 0, late: 0, missingPunch: 0, workingDays: 0, overtimeMinutes: 0, workedMinutes: 0 };
  for (const day of days) {
    t.overtimeMinutes += day.overtimeMinutes;
    t.workedMinutes += day.workedMinutes;
    if (day.late) t.late += 1;
    switch (day.code) {
      case "P": t.present += 1; break;
      case "HD": t.present += 0.5; t.halfDays += 1; break;
      case "SW": t.present += 1; t.offDayWorked += 1; break;
      case "A": t.absent += 1; break;
      case "MP": t.missingPunch += 1; break;
      case "L": t.leave += 1; break;
      case "L½": t.leave += 0.5; break;
      case "H": t.holidays += 1; break;
      case "WO": t.weekOffs += 1; break;
      default: break;
    }
    // Days so far that the person was expected to work (leave excluded): the "x / y" denominator.
    if (day.date <= today && day.kind === "Working" && day.code && !["L", "H", "WO", "CO"].includes(day.code))
      t.workingDays += day.code === "L½" ? 0.5 : 1;
  }
  return t;
}

async function month(user, q = {}, db = c.dbDefault) {
  c.permit(user, "view_own", "self_service", "approve", "hr_approve", "view_team", "view_all");
  const p = await c.policy(db);
  const today = c.today(p);
  const { start, end } = monthRange(q.month || today.slice(0, 7));
  const values = [];
  const clauses = [c.scope(user, values), "e.archived_at IS NULL", "e.status<>'Draft'"];
  values.push(end, start);
  clauses.push(`e.joining_date<=$${values.length - 1}`, `(e.exit_date IS NULL OR e.exit_date>=$${values.length})`);
  if (q.employeeId) {
    values.push(String(q.employeeId));
    clauses.push(`e.id=$${values.length}`);
  }
  // Column filter on the chart: several employees, comma separated.
  const ids = employeeIdList(q.employeeIds);
  if (ids.length) {
    values.push(ids);
    clauses.push(`e.id=ANY($${values.length}::text[])`);
  }
  if (q.locationId) {
    values.push(String(q.locationId));
    clauses.push(`e.location_id=$${values.length}`);
  }
  const search = c.text(q.search, "Search", 160);
  if (search) {
    values.push(`%${search}%`);
    clauses.push(`(e.full_name ILIKE $${values.length} OR e.employee_number ILIKE $${values.length} OR coalesce(e.employee_code,'') ILIKE $${values.length} OR coalesce(e.company_email,'') ILIKE $${values.length})`);
  }
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 10));
  const page = Math.max(1, Number(q.page) || 1);
  values.push(limit, (page - 1) * limit);
  const employees = (
    await db.query(
      `SELECT e.*, l.name AS location_name, count(*) OVER()::int AS list_total
         FROM hrm_employees e LEFT JOIN master_items l ON l.id=e.location_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY e.full_name ${q.sort === "desc" ? "DESC" : "ASC"}, e.id
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    )
  ).rows.map(c.camel);
  const total = employees[0]?.listTotal || 0;

  const shifts = (await db.query("SELECT id,name,payload FROM master_items WHERE type='hrm_shift'")).rows;
  const shiftOf = (id) => {
    const s = shifts.find((x) => x.id === id);
    return {
      name: s?.name || null,
      start: s?.payload?.start || p.shiftStart || null,
      end: s?.payload?.end || p.shiftEnd || null,
      breakMinutes: s?.payload?.breakMinutes ?? p.breakMinutes ?? 0,
    };
  };
  const rows = [];
  for (const e of employees) {
    const data = await calendarData(db, e.id, start, end);
    const attendance = (
      await db.query("SELECT * FROM hrm_attendance WHERE employee_id=$1 AND work_date BETWEEN $2 AND $3", [e.id, start, end])
    ).rows.map(c.camel);
    const byDate = new Map(attendance.map((a) => [a.workDate, a]));
    // Leave is applied per day here, so the calendar keeps "Working" for leave days.
    const days = calc.calendar(e, start, end, p, { ...data, leave: [] }).map((d) =>
      dayCell(
        d,
        byDate.get(d.date),
        data.leave.filter((l) => l.startDate <= d.date && l.endDate >= d.date),
        today,
        shiftOf(e.shiftId || p.defaultShiftId),
      ),
    );
    rows.push({
      employee: {
        id: e.id,
        fullName: e.fullName,
        employeeNumber: e.employeeNumber,
        employeeCode: e.employeeCode,
        location: e.locationName || null,
        status: e.status,
      },
      days,
      totals: totals(days, today),
    });
  }
  const dates = [];
  for (let d = start; d <= end; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)) dates.push(d);
  return { month: start.slice(0, 7), startDate: start, endDate: end, today, dates, rows, total, page, limit };
}

// Punch events worth drawing on a day's timeline (slot prompts and reminders are left out).
const TIMELINE_KINDS = ["clock_in", "job_start", "lunch_start", "lunch_end", "exit", "return", "offline", "online", "job_end", "clock_out", "auto_checkout"];
function timelineEvents(events) {
  return (events || [])
    .filter((ev) => TIMELINE_KINDS.includes(ev.kind))
    .map((ev) => ({ kind: ev.kind, at: ev.at, inside: ev.inside ?? null }))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

const READERS = ["view_own", "self_service", "approve", "hr_approve", "view_team", "view_all"];

/** One day for the calendar panel: punches, lunch, where they clocked in. Same scope as the month. */
async function timeline(user, q = {}, db = c.dbDefault) {
  c.permit(user, ...READERS);
  const e = await c.employee(db, user, String(q.employeeId || ""));
  const date = c.date(q.date, "Date");
  const att = c.camel(
    (
      await db.query(
        `SELECT a.*, g.label AS geofence_label, g.kind AS geofence_kind
           FROM hrm_attendance a LEFT JOIN hrm_geofences g ON g.id=a.geofence_id
          WHERE a.employee_id=$1 AND a.work_date=$2`,
        [e.id, date],
      )
    ).rows[0],
  );
  const events = att
    ? (await db.query("SELECT kind,at,inside FROM hrm_attendance_events WHERE attendance_id=$1 ORDER BY at,id", [att.id])).rows.map(c.camel)
    : [];
  return {
    date,
    now: new Date().toISOString(),
    attendance: att
      ? {
          checkIn: att.checkIn,
          checkOut: att.checkOut,
          lunchStart: att.lunchStartedAt || null,
          lunchEnd: att.lunchEndedAt || null,
          lunchMinutes: minutes(att.lunchMinutes),
          workMode: att.workMode || null,
          place: att.geofenceLabel || null,
          placeKind: att.geofenceKind || null,
          autoCheckoutAt: att.autoCheckoutAt || null,
          outsideMinutes: minutes(att.outsideMinutes),
          offlineMinutes: minutes(att.offlineMinutes),
          source: att.source || null,
        }
      : null,
    events: timelineEvents(events),
  };
}

/** Leave balance for the year and this month's leave / correction requests, for the calendar card. */
async function side(user, q = {}, db = c.dbDefault) {
  c.permit(user, ...READERS);
  const e = await c.employee(db, user, String(q.employeeId || ""));
  const p = await c.policy(db);
  const { start, end } = monthRange(q.month || c.today(p).slice(0, 7));
  const balances = (
    await db.query(
      `SELECT m.id, m.name, m.payload, coalesce(sum(l.amount),0)::float AS balance
         FROM master_items m
         LEFT JOIN hrm_leave_ledger l ON l.leave_type_id=m.id AND l.employee_id=$1 AND l.year=$2
        WHERE m.type='hrm_leave_type' AND m.is_active=true
        GROUP BY m.id ORDER BY m.name`,
      [e.id, Number(start.slice(0, 4))],
    )
  ).rows.map((r) => ({ id: r.id, name: r.name, balance: Number(r.balance) || 0, paid: r.payload?.paid !== false, monthly: r.payload?.accrual === "monthly" }));
  const requests = (
    await db.query(
      `SELECT id,kind,title,start_date,end_date,status,created_at FROM hrm_requests
        WHERE employee_id=$1 AND kind IN ('leave','regularization') AND status<>'Draft'
          AND ((start_date IS NOT NULL AND start_date<=$3 AND coalesce(end_date,start_date)>=$2)
               OR (created_at>=$2::date AND created_at<($3::date + 1)))
        ORDER BY created_at DESC LIMIT 10`,
      [e.id, start, end],
    )
  ).rows.map(c.camel);
  return { month: start.slice(0, 7), balances, requests };
}

module.exports = { month, monthRange, dayCell, totals, employeeIdList, timelineEvents, timeline, side };
