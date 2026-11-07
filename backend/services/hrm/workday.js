// Location-verified workday used by the employee app: clock in (office / home
// geofence), job timer, lunch, slot work reports, location pings, day summary
// and check-out — plus the admin side (geofences, alerts, overrides, back-dated
// report edits, live board).
const c = require("./core");
const calc = require("./calculations");
const d = require("./daylogic");
const { calendarData } = require("./operations");
const { ALERT_ACTIONS } = require("../../config/hrm");
const ACTIVE = ["Active", "Probation", "Confirmed", "Notice Period"];
const MODES = { WFO: "Present", WFH: "WFH", "Client Visit": "Business Visit" };

// ── shared helpers ──────────────────────────────────────────────────────────
async function own(tx, user, lock = false) {
  c.permit(user, "self_service");
  const r = await tx.query(
    `SELECT * FROM hrm_employees WHERE user_id=$1 AND archived_at IS NULL${lock ? " FOR UPDATE" : ""}`,
    [user.id],
  );
  if (!r.rows[0])
    c.fail("No employee profile is linked to this login", 404, "NO_EMPLOYEE");
  return c.camel(r.rows[0]);
}
function readLocation(body, p, { strict = true } = {}) {
  const loc = {
    latitude: c.number(body.latitude, "Latitude", -90, 90),
    longitude: c.number(body.longitude, "Longitude", -180, 180),
    accuracy: Math.round(c.number(body.accuracy ?? 99999, "GPS accuracy", 0, 1e6)),
  };
  if (strict && body.isMock === true)
    c.fail(
      "Fake / mock GPS location detected. Turn it off to continue.",
      403,
      "MOCK_LOCATION",
    );
  if (strict && loc.accuracy > p.maxGpsAccuracyMeters)
    c.fail(
      `GPS accuracy is ${loc.accuracy} m. Move near a window or open area and retry (needs ${p.maxGpsAccuracyMeters} m or better).`,
      422,
      "LOW_ACCURACY",
    );
  return loc;
}
const fence = (row) =>
  row && {
    ...c.camel(row),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  };
async function approvedFences(tx, employeeId) {
  return (
    await tx.query(
      "SELECT * FROM hrm_geofences WHERE status='Approved' AND (kind='office' OR employee_id=$1) ORDER BY kind,label",
      [employeeId],
    )
  ).rows.map(fence);
}
async function openSession(tx, employeeId) {
  return c.camel(
    (
      await tx.query(
        "SELECT * FROM hrm_attendance WHERE employee_id=$1 AND check_in IS NOT NULL AND check_out IS NULL FOR UPDATE",
        [employeeId],
      )
    ).rows[0],
  );
}
async function event(tx, att, kind, loc = {}, details = {}, extra = {}) {
  return c.insert(tx, "hrm_attendance_events", {
    attendanceId: att.id,
    employeeId: att.employeeId,
    kind,
    latitude: loc.latitude ?? null,
    longitude: loc.longitude ?? null,
    accuracy: loc.accuracy ?? null,
    details: JSON.stringify(details),
    ...extra,
  });
}
async function events(tx, attendanceId) {
  return (
    await tx.query(
      "SELECT * FROM hrm_attendance_events WHERE attendance_id=$1 ORDER BY at,id",
      [attendanceId],
    )
  ).rows.map(c.camel);
}
async function reportFor(tx, employeeId, workDate, create = false) {
  let r = c.camel(
    (
      await tx.query(
        "SELECT * FROM hrm_work_reports WHERE employee_id=$1 AND work_date=$2 FOR UPDATE",
        [employeeId, workDate],
      )
    ).rows[0],
  );
  if (!r && create)
    r = await c.insert(tx, "hrm_work_reports", { employeeId, workDate });
  return r;
}
async function entriesFor(tx, reportId) {
  if (!reportId) return [];
  return (
    await tx.query(
      "SELECT w.*,p.title AS project_title FROM hrm_work_entries w LEFT JOIN projects p ON p.id=w.project_id WHERE w.report_id=$1 ORDER BY coalesce(w.slot_start,w.created_at),w.id",
      [reportId],
    )
  ).rows.map(c.camel);
}
async function shiftOf(tx, e, p) {
  return (await c.master(tx, e.shiftId || p.defaultShiftId, "shift"))?.payload || {};
}
function inShift(now, shift, p) {
  return d.inWindow(now, shift.start || p.shiftStart, shift.end || p.shiftEnd, p.timezone);
}
async function openAlert(tx, e, att, kind, title, details = {}, options = {}) {
  const existing = await tx.query(
    "SELECT id FROM hrm_alerts WHERE employee_id=$1 AND work_date=$2 AND kind=$3 AND closed_at IS NULL AND status<>'Resolved'",
    [e.id, att?.workDate || options.workDate, kind],
  );
  if (existing.rowCount) return null;
  const alert = await c.insert(tx, "hrm_alerts", {
    employeeId: e.id,
    attendanceId: att?.id || null,
    workDate: att?.workDate || options.workDate,
    kind,
    title,
    details: JSON.stringify(details),
  });
  await c.notifyReviewers(tx, e, title, alert.id, options.actorId || null, {
    eventKey: `hrm_alert_${kind}`,
    severity: options.severity || "warning",
    message: options.message || "Open HRM overview to decide the action.",
    routePath: "/app/hrm/overview",
    data: { alertId: alert.id, employeeId: e.id },
  });
  return alert;
}
async function assertProject(tx, user, e, v, workDate) {
  if (!v.projectId) return;
  const project = (
    await tx.query("SELECT id,client_id,payload FROM projects WHERE id=$1", [v.projectId])
  ).rows[0];
  if (!project) c.fail("Project does not exist");
  const allocated = await tx.query(
    "SELECT id FROM hrm_allocations WHERE employee_id=$1 AND project_id=$2 AND start_date<=$3 AND end_date>=$3 AND archived_at IS NULL",
    [e.id, v.projectId, workDate],
  );
  const assignedTask = (project.payload.activities || []).some(
    (a) =>
      a.type === "task" &&
      (a.assignedTo === e.userId || (a.collaborators || []).includes(e.userId)),
  );
  if (!allocated.rowCount && project.payload.assignedTo !== e.userId && !assignedTask)
    c.fail("Work can only be logged against assigned projects", 403);
  v.clientId = project.client_id;
  if (v.taskId) {
    const choices = await require("./work").tasks(user, e.id, v.projectId, tx);
    if (!choices.some((t) => t.id === v.taskId && t.source === v.taskSource))
      c.fail("Task must be assigned to this employee and project");
  }
}
// Validates one slot / entry update. Repeating an earlier text (today or the
// last few reports) is rejected so updates cannot be copy-pasted.
async function entryValues(tx, user, e, body, p, workDate, exceptId = null) {
  c.allow(body, [
    "description",
    "projectId",
    "taskId",
    "taskSource",
    "completion",
    "blocker",
    "evidenceUrl",
    "billable",
  ]);
  const v = {
    description: c.text(body.description, "Work done", 4000, true),
    projectId: body.projectId || null,
    taskId: body.taskId || null,
    taskSource: body.taskId ? body.taskSource || null : null,
    blocker: c.text(body.blocker, "Blocker", 2000) || "",
    completion: c.number(body.completion ?? 0, "Completion", 0, 100),
    billable: c.boolean(body.billable ?? false, "Billable"),
    evidenceUrl: c.text(body.evidenceUrl, "Evidence link", 2000),
  };
  if (v.description.length < p.minSlotReportChars)
    c.fail(
      `Describe the work in at least ${p.minSlotReportChars} characters`,
      400,
      "REPORT_TOO_SHORT",
    );
  if (v.evidenceUrl && !/^https:\/\//i.test(v.evidenceUrl))
    c.fail("Evidence must be an HTTPS link");
  if (p.requireEvidence && !v.evidenceUrl) c.fail("Evidence link is required");
  if (p.requireProject && !v.projectId) c.fail("Select a project");
  const recent = await tx.query(
    `SELECT w.id,w.description FROM hrm_work_entries w JOIN hrm_work_reports r ON r.id=w.report_id
     WHERE r.employee_id=$1 AND r.work_date BETWEEN ($2::date - 7) AND $2::date AND w.id<>$3 ORDER BY w.created_at DESC LIMIT 60`,
    [e.id, workDate, exceptId || ""],
  );
  const text = d.normalizeText(v.description);
  if (recent.rows.some((x) => d.normalizeText(x.description) === text))
    c.fail(
      "This update repeats an earlier entry. Write what you actually did in this slot.",
      400,
      "DUPLICATE_REPORT",
    );
  await assertProject(tx, user, e, v, workDate);
  return v;
}
async function addSlot(tx, user, e, att, p, body, now, { final = false } = {}) {
  const report = await reportFor(tx, e.id, att.workDate, true);
  if (!["Draft", "Revision Requested"].includes(report.status))
    c.fail("Today's report is already submitted", 409);
  const entries = await entriesFor(tx, report.id);
  const s = d.slotState(att, entries, p, now);
  if (s.onLunch) c.fail("You are on lunch. End lunch first.", 409, "ON_LUNCH");
  if (s.workedMinutes < (final ? 1 : 5))
    c.fail(
      "Work at least 5 minutes in this slot before submitting it",
      409,
      "SLOT_TOO_EARLY",
    );
  const v = await entryValues(tx, user, e, body, p, att.workDate);
  const entry = await c.insert(tx, "hrm_work_entries", {
    ...v,
    reportId: report.id,
    minutes: Math.min(1440, s.workedMinutes),
    source: "slot",
    slotStart: s.slotStart,
    slotEnd: now,
  });
  if (s.lateMinutes > 0) {
    await tx.query(
      "UPDATE hrm_attendance SET idle_minutes=idle_minutes+$2,updated_at=now() WHERE id=$1",
      [att.id, s.lateMinutes],
    );
    await event(tx, att, "slot_late", {}, { minutes: s.lateMinutes, dueAt: s.dueAt });
  }
  await event(tx, att, "slot_submitted", {}, { entryId: entry.id, minutes: entry.minutes, dueAt: s.dueAt });
  return entry;
}
// Ends lunch / job / session at `at` (used by force checkout and automation).
async function closeSession(tx, att, p, at, reason, actor = null) {
  const shift = att.shiftSnapshot || {};
  const end = new Date(Math.max(new Date(at).getTime(), new Date(att.checkIn).getTime() + 60000));
  const patch = { updatedAt: new Date() };
  let breakMinutes = Number(att.breakMinutes || 0);
  if (att.lunchStartedAt && !att.lunchEndedAt) {
    const m = Math.max(0, Math.floor((end - new Date(att.lunchStartedAt)) / 60000));
    Object.assign(patch, { lunchEndedAt: end, lunchMinutes: m, breakStartedAt: null });
    breakMinutes += m;
  } else if (att.breakStartedAt) {
    breakMinutes += Math.max(0, Math.floor((end - new Date(att.breakStartedAt)) / 60000));
    patch.breakStartedAt = null;
  }
  if (att.jobStartedAt && !att.jobEndedAt)
    patch.jobEndedAt = new Date(Math.max(end, new Date(att.jobStartedAt)));
  const values = { ...att, ...patch, checkOut: end.toISOString(), breakMinutes };
  const metrics = calc.attendanceMetrics(values, shift, p);
  const report = await reportFor(tx, att.employeeId, att.workDate);
  const summary = d.summarize(
    { ...values, ...metrics },
    await entriesFor(tx, report?.id),
    await events(tx, att.id),
    p,
    end,
  );
  const saved = await c.update(tx, "hrm_attendance", att.id, {
    ...patch,
    checkOut: end,
    breakMinutes,
    ...metrics,
    summary: JSON.stringify(summary),
  });
  await event(tx, att, "auto_checkout", {}, { reason, by: actor });
  return saved;
}
function publicPolicy(p) {
  const keys = [
    "timezone",
    "shiftStart",
    "shiftEnd",
    "reportIntervalMinutes",
    "slotGraceMinutes",
    "minSlotReportChars",
    "lunchWindowStart",
    "lunchWindowEnd",
    "lunchMaxMinutes",
    "pingIntervalMinutes",
    "offlineAfterMinutes",
    "maxGpsAccuracyMeters",
    "reportDeadline",
    "requireProject",
    "requireEvidence",
    "geofenceRequired",
    "allowWebAttendance",
    "absentIfNoReport",
  ];
  return Object.fromEntries(keys.map((k) => [k, p[k]]));
}
async function dayState(tx, e, p, workDate, now = new Date()) {
  const att = c.camel(
    (
      await tx.query("SELECT * FROM hrm_attendance WHERE employee_id=$1 AND work_date=$2", [
        e.id,
        workDate,
      ])
    ).rows[0],
  );
  const report = await reportFor(tx, e.id, workDate);
  const entries = await entriesFor(tx, report?.id);
  const evs = att ? await events(tx, att.id) : [];
  const alerts = (
    await tx.query(
      "SELECT * FROM hrm_alerts WHERE employee_id=$1 AND work_date=$2 ORDER BY opened_at DESC",
      [e.id, workDate],
    )
  ).rows.map(c.camel);
  const live = att?.checkIn && !att.checkOut;
  return {
    workDate,
    attendance: att,
    report,
    entries,
    events: evs,
    alerts,
    slot: live ? d.slotState(att, entries, p, now) : null,
    // Recomputed from stored facts so later entry edits are always reflected.
    summary: d.summarize(att, entries, evs, p, now),
  };
}

// ── employee app ────────────────────────────────────────────────────────────
async function today(user, db = c.dbDefault) {
  const e = await own(db, user);
  const p = await c.policy(db);
  const day = c.today(p);
  const meta = (
    await db.query(
      `SELECT d.name AS department,g.name AS designation,m.full_name AS manager_name,l.name AS location
       FROM hrm_employees e LEFT JOIN master_items d ON d.id=e.department_id LEFT JOIN master_items g ON g.id=e.designation_id
       LEFT JOIN hrm_employees m ON m.id=e.manager_id LEFT JOIN master_items l ON l.id=e.location_id WHERE e.id=$1`,
      [e.id],
    )
  ).rows[0];
  const fences = (
    await db.query(
      "SELECT * FROM hrm_geofences WHERE (kind='office' AND status='Approved') OR (kind='home' AND employee_id=$1 AND status IN ('Pending','Approved','Rejected')) ORDER BY created_at DESC",
      [e.id],
    )
  ).rows.map(fence);
  const leave = (
    await db.query(
      "SELECT id,title,status,details FROM hrm_requests WHERE employee_id=$1 AND kind='leave' AND status IN ('Submitted','Manager Approved','Approved') AND start_date<=$2 AND end_date>=$2",
      [e.id, day],
    )
  ).rows.map(c.camel);
  const state = await dayState(db, e, p, day);
  const openSessionRow =
    state.attendance?.checkIn && !state.attendance.checkOut
      ? null
      : c.camel(
          (
            await db.query(
              "SELECT * FROM hrm_attendance WHERE employee_id=$1 AND check_in IS NOT NULL AND check_out IS NULL",
              [e.id],
            )
          ).rows[0],
        );
  return {
    serverTime: new Date().toISOString(),
    employee: {
      id: e.id,
      employeeNumber: e.employeeNumber,
      fullName: e.fullName,
      companyEmail: e.companyEmail,
      phone: e.phone,
      workMode: e.workMode,
      status: e.status,
      joiningDate: e.joiningDate,
      ...c.camel(meta),
    },
    policy: publicPolicy(p),
    offices: fences.filter((f) => f.kind === "office"),
    home: fences.find((f) => f.kind === "home" && f.status !== "Rejected") || null,
    homeRejected: fences.find((f) => f.kind === "home" && f.status === "Rejected") || null,
    leaveToday: leave,
    // A session left open from a previous day is surfaced so it can be closed.
    staleSession: openSessionRow && openSessionRow.workDate !== day ? openSessionRow : null,
    ...state,
  };
}
async function clockIn(user, body, db = null) {
  c.allow(body, ["mode", "latitude", "longitude", "accuracy", "isMock", "reason", "client"]);
  return c.transaction(async (tx) => {
    const e = await own(tx, user, true);
    const p = await c.policy(tx);
    const day = c.today(p);
    const now = new Date();
    const client = c.choice(body.client || "app", ["app", "web"], "Client");
    if (client === "web" && !p.allowWebAttendance)
      c.fail("Web attendance is turned off. Use the Webitof Employee app.", 403, "WEB_DISABLED");
    if (
      e.joiningDate > day ||
      (e.exitDate && e.exitDate < day) ||
      !ACTIVE.includes(e.status)
    )
      c.fail("Attendance requires active employment");
    if (await openSession(tx, e.id))
      c.fail("An attendance session is already open", 409, "SESSION_OPEN");
    const locked = await tx.query(
      "SELECT p.id FROM hrm_payroll_runs p JOIN hrm_payroll_entries pe ON pe.run_id=p.id WHERE pe.employee_id=$1 AND p.start_date<=$2 AND p.end_date>=$2",
      [e.id, day],
    );
    if (locked.rowCount) c.fail("Attendance period is locked by payroll", 409);
    const data = await calendarData(tx, e.id, day, day);
    const available = calc.calendar(e, day, day, p, data)[0];
    if (available.kind === "Leave") c.fail("Full-day approved leave covers today");
    const existing = c.camel(
      (
        await tx.query(
          "SELECT * FROM hrm_attendance WHERE employee_id=$1 AND work_date=$2 FOR UPDATE",
          [e.id, day],
        )
      ).rows[0],
    );
    if (existing && (existing.checkIn || existing.status !== "Half Day"))
      c.fail(
        existing.checkOut
          ? "You have already clocked out today"
          : "Attendance already exists for today; request regularization",
        409,
        "ALREADY_MARKED",
      );
    const loc = readLocation(body, p);
    const fences = await approvedFences(tx, e.id);
    const office = d.nearest(loc, fences.filter((f) => f.kind === "office"), p);
    const home = d.nearest(loc, fences.filter((f) => f.kind === "home"), p);
    let mode = c.choice(body.mode || "auto", ["auto", ...Object.keys(MODES)], "Work mode");
    let match = null;
    if (mode === "auto") {
      if (office?.inside) mode = "WFO";
      else if (home?.inside) mode = "WFH";
      else
        c.fail(
          office
            ? `You are ${office.distance} m from ${office.fence.label} (allowed ${office.fence.radiusMeters} m) and not at an approved home location.`
            : "No approved office or home location matches where you are.",
          403,
          "OUTSIDE_ZONE",
        );
    }
    if (mode === "WFO") {
      if (!office) c.fail("No office location is configured yet. Contact HR.", 409, "NO_OFFICE");
      if (!office.inside)
        c.fail(
          `You are ${office.distance} m from ${office.fence.label}. Move inside the office zone (${office.fence.radiusMeters} m) to clock in.`,
          403,
          "OUTSIDE_ZONE",
        );
      match = office;
    } else if (mode === "WFH") {
      if (!home) {
        const pending = await tx.query(
          "SELECT id FROM hrm_geofences WHERE kind='home' AND employee_id=$1 AND status='Pending'",
          [e.id],
        );
        c.fail(
          pending.rowCount
            ? "Your home location is waiting for admin approval."
            : "Register your home location first. Admin approval is needed once.",
          409,
          pending.rowCount ? "HOME_PENDING" : "HOME_REQUIRED",
        );
      }
      if (!home.inside)
        c.fail(
          `You are ${home.distance} m from your approved home location (allowed ${home.fence.radiusMeters} m).`,
          403,
          "OUTSIDE_ZONE",
        );
      match = home;
    } else {
      const reason = c.text(body.reason, "Client visit reason", 1000, true);
      if (reason.length < 10) c.fail("Explain the client visit in at least 10 characters");
    }
    const shift = await shiftOf(tx, e, p);
    const values = {
      checkIn: now,
      status: existing?.status === "Half Day" ? "Half Day" : MODES[mode],
      workMode: mode,
      geofenceId: match?.fence.id || null,
      source: client,
      lastPingAt: now,
      lastLocation: JSON.stringify(loc),
      shiftSnapshot: JSON.stringify(shift),
      updatedAt: now,
    };
    // Approved half-day leave from a time today ends the session automatically.
    const halfFrom = data.leave.find((l) => l.details.fraction === 0.5 && l.details.fromTime);
    if (halfFrom)
      values.autoCheckoutAt = new Date(calc.localInstant(day, halfFrom.details.fromTime, p.timezone));
    const att = existing
      ? await c.update(tx, "hrm_attendance", existing.id, values)
      : await c.insert(tx, "hrm_attendance", { employeeId: e.id, workDate: day, ...values });
    await event(tx, att, "clock_in", loc, {
      mode,
      client,
      fence: match?.fence.label || null,
      distance: match?.distance ?? null,
    }, { inside: match ? true : null, distanceMeters: match?.distance ?? null });
    if (mode === "Client Visit")
      await openAlert(tx, e, att, "client_visit", `${e.fullName} clocked in from a client visit`, {
        reason: body.reason,
        location: loc,
      }, { severity: "info", message: c.text(body.reason, "Reason", 1000) });
    await c.audit(tx, user, "attendance", att.id, "app-check-in", existing, att, e.id);
    return dayState(tx, e, p, day, now);
  }, db);
}
async function job(user, body, db = null) {
  c.allow(body, ["action", "finalEntry"]);
  return c.transaction(async (tx) => {
    const e = await own(tx, user, true);
    const p = await c.policy(tx);
    const now = new Date();
    const att = await openSession(tx, e.id);
    if (!att) c.fail("Clock in first", 409, "NO_SESSION");
    const action = c.choice(body.action, ["start", "end"], "Action");
    if (action === "start") {
      if (att.jobStartedAt) c.fail("Job timer is already running", 409);
      await c.update(tx, "hrm_attendance", att.id, { jobStartedAt: now, lastPingAt: now, updatedAt: now });
      await event(tx, att, "job_start");
    } else {
      if (!att.jobStartedAt) c.fail("Start the job first", 409);
      if (att.jobEndedAt) c.fail("Job already ended", 409);
      if (att.lunchStartedAt && !att.lunchEndedAt)
        c.fail("End lunch before ending the job", 409, "ON_LUNCH");
      const report = await reportFor(tx, e.id, att.workDate);
      const entries = await entriesFor(tx, report?.id);
      const s = d.slotState(att, entries, p, now);
      if (s.workedMinutes >= 5) {
        if (!body.finalEntry)
          c.fail(
            `Report the last ${s.workedMinutes} minutes of work before ending the job`,
            409,
            "FINAL_SLOT_REQUIRED",
          );
        await addSlot(tx, user, e, att, p, body.finalEntry, now, { final: true });
      } else if (!entries.length && !body.finalEntry)
        c.fail("Add at least one work report before ending the job", 409, "FINAL_SLOT_REQUIRED");
      else if (body.finalEntry)
        await addSlot(tx, user, e, att, p, body.finalEntry, now, { final: true });
      await c.update(tx, "hrm_attendance", att.id, { jobEndedAt: now, updatedAt: now });
      await event(tx, att, "job_end");
    }
    await c.audit(tx, user, "attendance", att.id, `job-${action}`, null, null, e.id);
    return dayState(tx, e, p, att.workDate, now);
  }, db);
}
async function lunch(user, body, db = null) {
  c.allow(body, ["action"]);
  return c.transaction(async (tx) => {
    const e = await own(tx, user, true);
    const p = await c.policy(tx);
    const now = new Date();
    const att = await openSession(tx, e.id);
    if (!att) c.fail("Clock in first", 409, "NO_SESSION");
    const action = c.choice(body.action, ["start", "end"], "Action");
    if (action === "start") {
      if (!att.jobStartedAt || att.jobEndedAt) c.fail("Lunch is available while the job is running", 409);
      if (att.lunchStartedAt) c.fail("Lunch is already taken today", 409, "LUNCH_TAKEN");
      if (!d.inWindow(now, p.lunchWindowStart, p.lunchWindowEnd, p.timezone))
        c.fail(
          `Lunch can be started between ${p.lunchWindowStart} and ${p.lunchWindowEnd}`,
          409,
          "LUNCH_WINDOW",
        );
      await c.update(tx, "hrm_attendance", att.id, {
        lunchStartedAt: now,
        breakStartedAt: now,
        updatedAt: now,
      });
      await event(tx, att, "lunch_start");
    } else {
      if (!att.lunchStartedAt || att.lunchEndedAt) c.fail("No lunch in progress", 409);
      const minutes = Math.max(0, Math.floor((now - new Date(att.lunchStartedAt)) / 60000));
      await c.update(tx, "hrm_attendance", att.id, {
        lunchEndedAt: now,
        lastPingAt: now,
        lunchMinutes: minutes,
        breakMinutes: Number(att.breakMinutes || 0) + minutes,
        breakStartedAt: null,
        updatedAt: now,
      });
      await event(tx, att, "lunch_end", {}, { minutes });
      if (minutes > p.lunchMaxMinutes)
        await openAlert(
          tx,
          e,
          att,
          "lunch_overrun",
          `${e.fullName} took ${minutes} min lunch (allowed ${p.lunchMaxMinutes})`,
          { minutes, allowed: p.lunchMaxMinutes },
          { severity: "info" },
        );
    }
    return dayState(tx, e, p, att.workDate, now);
  }, db);
}
async function submitSlot(user, body, db = null) {
  return c.transaction(async (tx) => {
    const e = await own(tx, user, true);
    const p = await c.policy(tx);
    const now = new Date();
    const att = await openSession(tx, e.id);
    if (!att?.jobStartedAt || att.jobEndedAt)
      c.fail("Slot reports are accepted while the job is running", 409, "JOB_NOT_RUNNING");
    const entry = await addSlot(tx, user, e, att, p, body, now);
    await c.audit(tx, user, "work-entries", entry.id, "slot-submitted", null, entry, e.id);
    return dayState(tx, e, p, att.workDate, now);
  }, db);
}
// Employees may edit only today's entries before the report is submitted.
// Every edit is counted and kept in the audit trail for the admin.
async function editEntry(user, id, body, db = null) {
  return c.transaction(async (tx) => {
    const e = await own(tx, user, true);
    const p = await c.policy(tx);
    const old = c.camel(
      (
        await tx.query(
          "SELECT w.*,r.work_date,r.status AS report_status,r.employee_id,r.id AS rid FROM hrm_work_entries w JOIN hrm_work_reports r ON r.id=w.report_id WHERE w.id=$1 FOR UPDATE OF w",
          [id],
        )
      ).rows[0],
    );
    if (!old || old.employeeId !== e.id) c.fail("Entry not found", 404);
    if (old.workDate !== c.today(p))
      c.fail("Past work reports can only be edited by an admin", 403, "BACKDATE_LOCKED");
    if (!["Draft", "Revision Requested"].includes(old.reportStatus))
      c.fail("Submitted reports cannot be edited", 409);
    const v = await entryValues(tx, user, e, body, p, old.workDate, id);
    const saved = await c.update(tx, "hrm_work_entries", id, {
      ...v,
      editCount: Number(old.editCount || 0) + 1,
      editedAt: new Date(),
      updatedAt: new Date(),
    });
    await tx.query(
      "UPDATE hrm_work_reports SET edit_count=edit_count+1,version=version+1,updated_at=now() WHERE id=$1",
      [old.rid],
    );
    await c.audit(tx, user, "work-entries", id, "edited", old, saved, e.id);
    return dayState(tx, e, p, old.workDate);
  }, db);
}
async function checkOut(user, body, db = null) {
  c.allow(body, ["summary", "latitude", "longitude", "accuracy", "isMock"]);
  return c.transaction(async (tx) => {
    const e = await own(tx, user, true);
    const p = await c.policy(tx);
    const now = new Date();
    const att = await openSession(tx, e.id);
    if (!att) c.fail("No open attendance session", 409, "NO_SESSION");
    if (att.jobStartedAt && !att.jobEndedAt)
      c.fail("End the job first to review your day summary", 409, "JOB_RUNNING");
    const report = await reportFor(tx, e.id, att.workDate);
    const entries = await entriesFor(tx, report?.id);
    if (att.jobStartedAt && !entries.length)
      c.fail("Add at least one work report before clocking out", 409);
    if (report && entries.length && ["Draft", "Revision Requested"].includes(report.status)) {
      const status = p.requireReportApproval ? "Submitted" : "Approved";
      await c.update(tx, "hrm_work_reports", report.id, {
        status,
        summary: c.text(body.summary, "Day summary", 4000) || report.summary || "",
        submittedAt: now,
        version: report.version + 1,
        updatedAt: now,
      });
      const manager = (
        await tx.query("SELECT user_id FROM hrm_employees WHERE id=$1", [e.managerId])
      ).rows[0];
      await c.notify(tx, manager?.user_id, `${e.fullName} submitted the daily work report`, report.id, user.id, {
        eventKey: "work_report_submitted",
        routePath: "/app/hrm/work-reports",
      });
    }
    const loc =
      body.latitude != null ? readLocation(body, p, { strict: false }) : {};
    const values = { ...att, checkOut: now.toISOString() };
    const metrics = calc.attendanceMetrics(values, att.shiftSnapshot || {}, p);
    const evs = await events(tx, att.id);
    const summary = d.summarize({ ...values, ...metrics }, entries, evs, p, now);
    const saved = await c.update(tx, "hrm_attendance", att.id, {
      checkOut: now,
      ...metrics,
      summary: JSON.stringify(summary),
      updatedAt: now,
    });
    await event(tx, att, "clock_out", loc);
    await c.audit(tx, user, "attendance", att.id, "app-check-out", att, saved, e.id);
    return dayState(tx, e, p, att.workDate, now);
  }, db);
}
async function ping(user, body, db = null) {
  c.allow(body, ["latitude", "longitude", "accuracy", "isMock", "battery"]);
  return c.transaction(async (tx) => {
    const e = await own(tx, user, true);
    const p = await c.policy(tx);
    const now = new Date();
    const att = await openSession(tx, e.id);
    if (!att) return { active: false, serverTime: now.toISOString() };
    const loc = readLocation(body, p, { strict: false });
    const onLunch = Boolean(att.lunchStartedAt && !att.lunchEndedAt);
    const running = Boolean(att.jobStartedAt && !att.jobEndedAt);
    const patch = { lastPingAt: now, lastLocation: JSON.stringify(loc), updatedAt: now };
    if (body.isMock === true)
      await openAlert(tx, e, att, "mock_location", `${e.fullName} is using a fake GPS app`, { location: loc });
    // Back online after a silent gap: count the gap as offline time.
    const gap = att.lastPingAt ? Math.floor((now - new Date(att.lastPingAt)) / 60000) : 0;
    if (running && !onLunch && gap > p.offlineAfterMinutes) {
      const lost = Math.max(0, gap - p.pingIntervalMinutes);
      patch.offlineMinutes = Number(att.offlineMinutes || 0) + lost;
      await event(tx, att, "online", loc, { offlineMinutes: lost });
      await tx.query(
        "UPDATE hrm_alerts SET closed_at=now(),status='Resolved',details=details||$2::jsonb,updated_at=now() WHERE attendance_id=$1 AND kind='offline' AND closed_at IS NULL",
        [att.id, JSON.stringify({ backOnlineAt: now, offlineMinutes: lost })],
      );
    }
    let inside = null;
    let distance = null;
    // Consecutive pings seen outside the fence. One stray fix (bad GPS, a moment at the door) must not
    // raise a breach alert and notify the employee; it takes geofenceBreachPings in a row (default 2).
    let strikes = 0;
    if (att.geofenceId && body.isMock !== true && loc.accuracy <= p.maxGpsAccuracyMeters * 2) {
      const f = fence(
        (await tx.query("SELECT * FROM hrm_geofences WHERE id=$1", [att.geofenceId])).rows[0],
      );
      const n = f && d.nearest(loc, [f], p);
      if (n) {
        inside = n.inside;
        distance = n.distance;
        strikes = inside ? 0 : Number(att.lastLocation?.strikes || 0) + 1;
        const evs = (
          await tx.query(
            "SELECT kind,at FROM hrm_attendance_events WHERE attendance_id=$1 AND kind IN ('exit','return') ORDER BY at DESC LIMIT 1",
            [att.id],
          )
        ).rows;
        const outside = evs[0]?.kind === "exit";
        const shift = att.shiftSnapshot || {};
        if (
          !inside &&
          !outside &&
          running &&
          !onLunch &&
          inShift(now, shift, p) &&
          strikes >= (Number(p.geofenceBreachPings) || 2)
        ) {
          await event(tx, att, "exit", loc, { fence: f.label }, { inside: false, distanceMeters: distance });
          await openAlert(
            tx,
            e,
            att,
            "geofence_breach",
            `${e.fullName} left ${f.label} during office hours (${distance} m away)`,
            { fence: f.label, distance, location: loc, exitAt: now },
            { message: "Decide: ignore, ask explanation, warn, half day, absent or force clock-out." },
          );
          await c.notify(tx, e.userId, "You are outside your work zone", att.id, null, {
            eventKey: "geofence_exit",
            severity: "warning",
            message: `You are ${distance} m from ${f.label}. Your manager has been notified.`,
            tag: "geofence",
          });
        } else if (inside && outside) {
          const minutes = Math.floor((now - new Date(evs[0].at)) / 60000);
          patch.outsideMinutes = Number(att.outsideMinutes || 0) + minutes;
          await event(tx, att, "return", loc, { minutes }, { inside: true, distanceMeters: distance });
          await tx.query(
            "UPDATE hrm_alerts SET closed_at=now(),status='Resolved',details=details||$2::jsonb,updated_at=now() WHERE attendance_id=$1 AND kind='geofence_breach' AND closed_at IS NULL",
            [att.id, JSON.stringify({ returnedAt: now, outsideMinutes: minutes })],
          );
        }
      }
    }
    patch.lastLocation = JSON.stringify({ ...loc, inside, strikes });
    await c.update(tx, "hrm_attendance", att.id, patch);
    const report = await reportFor(tx, e.id, att.workDate);
    return {
      active: true,
      serverTime: now.toISOString(),
      inside,
      distance,
      onLunch,
      slot: d.slotState({ ...att, ...patch }, await entriesFor(tx, report?.id), p, now),
    };
  }, db);
}
async function requestHome(user, body, db = null) {
  c.allow(body, ["latitude", "longitude", "accuracy", "isMock", "address"]);
  return c.transaction(async (tx) => {
    const e = await own(tx, user, true);
    const p = await c.policy(tx);
    const loc = readLocation(body, p);
    const live = c.camel(
      (
        await tx.query(
          "SELECT * FROM hrm_geofences WHERE kind='home' AND employee_id=$1 AND status IN ('Pending','Approved') FOR UPDATE",
          [e.id],
        )
      ).rows[0],
    );
    if (live?.status === "Approved")
      c.fail("Your home location is already approved. Ask HR to reset it if you moved.", 409);
    const values = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      requestAccuracy: loc.accuracy,
      address: c.text(body.address, "Address", 500),
      updatedAt: new Date(),
    };
    const saved = live
      ? await c.update(tx, "hrm_geofences", live.id, values)
      : await c.insert(tx, "hrm_geofences", {
          ...values,
          kind: "home",
          employeeId: e.id,
          label: `Home – ${e.fullName}`,
          radiusMeters: p.defaultHomeRadiusMeters,
          status: "Pending",
          createdBy: user.id,
        });
    await c.audit(tx, user, "geofences", saved.id, "home-requested", live, saved, e.id);
    await c.notifyReviewers(tx, e, `${e.fullName} requested home (WFH) location approval`, saved.id, user.id, {
      eventKey: "home_geofence_requested",
      routePath: "/app/hrm/geofences",
      data: { geofenceId: saved.id },
    });
    return fence(saved);
  }, db);
}
async function explainAlert(user, id, body, db = null) {
  c.allow(body, ["explanation"]);
  return c.transaction(async (tx) => {
    const e = await own(tx, user, true);
    const a = c.camel(
      (await tx.query("SELECT * FROM hrm_alerts WHERE id=$1 FOR UPDATE", [id])).rows[0],
    );
    if (!a || a.employeeId !== e.id) c.fail("Alert not found", 404);
    if (a.status === "Resolved") c.fail("This alert is already resolved", 409);
    const saved = await c.update(tx, "hrm_alerts", id, {
      explanation: c.text(body.explanation, "Explanation", 2000, true),
      status: "Explained",
      updatedAt: new Date(),
    });
    await c.notifyReviewers(tx, e, `${e.fullName} explained: ${a.title}`, id, user.id, {
      eventKey: "hrm_alert_explained",
      message: saved.explanation,
      routePath: "/app/hrm/overview",
    });
    return saved;
  }, db);
}
async function registerDevice(user, body, db = c.dbDefault) {
  c.allow(body, ["token", "platform", "appVersion"]);
  const token = c.text(body.token, "Device token", 4096, true);
  await db.query(
    `INSERT INTO hrm_devices(id,user_id,token,platform,app_version) VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id,platform=excluded.platform,app_version=excluded.app_version,last_seen_at=now()`,
    [
      require("../../utils/format").createId("dev"),
      user.id,
      token,
      c.choice(body.platform || "android", ["android", "ios", "web"], "Platform"),
      c.text(body.appVersion, "App version", 40),
    ],
  );
  return { registered: true };
}
async function removeDevice(user, body, db = c.dbDefault) {
  await db.query("DELETE FROM hrm_devices WHERE user_id=$1 AND token=$2", [
    user.id,
    String(body.token || ""),
  ]);
  return { removed: true };
}

// ── admin side ──────────────────────────────────────────────────────────────
async function listGeofences(user, q = {}, db = c.dbDefault) {
  c.permit(user, "approve", "hr_approve", "manage_settings");
  const values = [];
  const s = c.scope(user, values);
  const clauses = [`(g.kind='office' OR ${s})`];
  if (q.kind) {
    values.push(q.kind);
    clauses.push(`g.kind=$${values.length}`);
  }
  if (q.status) {
    values.push(q.status);
    clauses.push(`g.status=$${values.length}`);
  }
  return (
    await db.query(
      `SELECT g.*,e.full_name AS employee_name,e.employee_number,m.name AS location_name FROM hrm_geofences g
       LEFT JOIN hrm_employees e ON e.id=g.employee_id LEFT JOIN master_items m ON m.id=g.location_id
       WHERE ${clauses.join(" AND ")} ORDER BY (g.status='Pending') DESC,g.kind,g.updated_at DESC LIMIT 500`,
      values,
    )
  ).rows.map(fence);
}
async function saveOffice(user, body, id = null, db = null) {
  c.permit(user, "manage_settings");
  c.allow(body, ["label", "address", "latitude", "longitude", "radiusMeters", "locationId", "status"]);
  return c.transaction(async (tx) => {
    const old = id
      ? c.camel((await tx.query("SELECT * FROM hrm_geofences WHERE id=$1 AND kind='office' FOR UPDATE", [id])).rows[0])
      : null;
    if (id && !old) c.fail("Office location not found", 404);
    if (body.locationId) await c.master(tx, body.locationId, "location", true);
    const values = {
      label: c.text(body.label, "Office name", 120, true),
      address: c.text(body.address, "Address", 500),
      latitude: c.number(body.latitude, "Latitude", -90, 90),
      longitude: c.number(body.longitude, "Longitude", -180, 180),
      radiusMeters: Math.round(c.number(body.radiusMeters, "Radius (m)", 20, 5000)),
      locationId: body.locationId || null,
      status: c.choice(body.status || "Approved", ["Approved", "Retired"], "Status"),
      updatedAt: new Date(),
    };
    const saved = old
      ? await c.update(tx, "hrm_geofences", id, values)
      : await c.insert(tx, "hrm_geofences", {
          ...values,
          kind: "office",
          reviewedBy: user.id,
          reviewedAt: new Date(),
          createdBy: user.id,
        });
    await c.audit(tx, user, "geofences", saved.id, old ? "office-updated" : "office-created", old, saved);
    return fence(saved);
  }, db);
}
async function geofenceAction(user, id, body, db = null) {
  c.allow(body, ["action", "radiusMeters", "comment", "latitude", "longitude"]);
  return c.transaction(async (tx) => {
    const g = c.camel((await tx.query("SELECT * FROM hrm_geofences WHERE id=$1 FOR UPDATE", [id])).rows[0]);
    if (!g) c.fail("Location not found", 404);
    const action = c.choice(body.action, ["approve", "reject", "retire"], "Action");
    let e = null;
    if (g.kind === "home") {
      c.permit(user, "approve", "hr_approve");
      e = await c.employee(tx, user, g.employeeId, { lock: true });
      if (e.userId === user.id) c.fail("You cannot approve your own location", 403);
    } else c.permit(user, "manage_settings");
    if (action !== "retire" && g.status !== "Pending")
      c.fail("Only pending locations can be approved or rejected", 409);
    const patch = {
      status: { approve: "Approved", reject: "Rejected", retire: "Retired" }[action],
      reviewedBy: user.id,
      reviewedAt: new Date(),
      comment: c.text(body.comment, "Comment", 1000, action === "reject"),
      updatedAt: new Date(),
    };
    if (action === "approve" && body.radiusMeters != null)
      patch.radiusMeters = Math.round(c.number(body.radiusMeters, "Radius (m)", 20, 5000));
    if (action === "approve" && body.latitude != null) {
      patch.latitude = c.number(body.latitude, "Latitude", -90, 90);
      patch.longitude = c.number(body.longitude, "Longitude", -180, 180);
    }
    const saved = await c.update(tx, "hrm_geofences", id, patch);
    await c.audit(tx, user, "geofences", id, action, g, saved, g.employeeId);
    if (e)
      await c.notify(
        tx,
        e.userId,
        action === "approve"
          ? "Home location approved — Work From Home clock-in is now automatic"
          : action === "reject"
            ? "Home location request rejected"
            : "Home location was reset — register it again",
        id,
        user.id,
        { eventKey: "home_geofence_reviewed", message: patch.comment || undefined },
      );
    return fence(saved);
  }, db);
}
async function listAlerts(user, q = {}, db = c.dbDefault) {
  c.permit(user, "approve", "hr_approve");
  const values = [];
  const clauses = [c.scope(user, values)];
  if (q.status === "open") clauses.push("a.status<>'Resolved'");
  else if (q.status) {
    values.push(q.status);
    clauses.push(`a.status=$${values.length}`);
  }
  if (q.employeeId) {
    values.push(q.employeeId);
    clauses.push(`a.employee_id=$${values.length}`);
  }
  if (q.date) {
    values.push(c.date(q.date));
    clauses.push(`a.work_date=$${values.length}`);
  }
  // Date range for browsing past alerts (resolved ones are otherwise only reachable one day at a time).
  if (q.from) {
    values.push(c.date(q.from, "From date"));
    clauses.push(`a.work_date>=$${values.length}`);
  }
  if (q.to) {
    values.push(c.date(q.to, "To date"));
    clauses.push(`a.work_date<=$${values.length}`);
  }
  if (q.kind) {
    values.push(String(q.kind).slice(0, 40));
    clauses.push(`a.kind=$${values.length}`);
  }
  // Newest first once resolved alerts are included; open ones still sort ahead of resolved.
  return (
    await db.query(
      `SELECT a.*,e.full_name AS employee_name,e.employee_number FROM hrm_alerts a JOIN hrm_employees e ON e.id=a.employee_id
       WHERE ${clauses.join(" AND ")} ORDER BY (a.status='Resolved'),a.opened_at DESC LIMIT 200`,
      values,
    )
  ).rows.map(c.camel);
}
async function overrideDay(tx, user, e, workDate, status, comment, p) {
  if (await c.payrollLocked(tx, e.id, workDate)) c.fail("Payroll has locked this date", 409);
  const old = c.camel(
    (
      await tx.query("SELECT * FROM hrm_attendance WHERE employee_id=$1 AND work_date=$2 FOR UPDATE", [
        e.id,
        workDate,
      ])
    ).rows[0],
  );
  const override = JSON.stringify({
    by: user.id,
    at: new Date(),
    from: old?.status || null,
    to: status,
    comment,
  });
  const saved = old
    ? await c.update(tx, "hrm_attendance", old.id, { status, override, updatedAt: new Date() })
    : await c.insert(tx, "hrm_attendance", { employeeId: e.id, workDate, status, source: "hr", override });
  await c.audit(tx, user, "attendance", saved.id, "override", old, { ...saved, comment }, e.id);
  await c.notify(tx, e.userId, `Attendance for ${workDate} set to ${status} by admin`, saved.id, user.id, {
    eventKey: "attendance_override",
    message: comment,
  });
  return saved;
}
async function alertAction(user, id, body, db = null) {
  c.allow(body, ["action", "comment"]);
  return c.transaction(async (tx) => {
    c.permit(user, "approve", "hr_approve");
    const a = c.camel((await tx.query("SELECT * FROM hrm_alerts WHERE id=$1 FOR UPDATE", [id])).rows[0]);
    if (!a) c.fail("Alert not found", 404);
    if (a.status === "Resolved") c.fail("This alert is already resolved", 409);
    const e = await c.employee(tx, user, a.employeeId, { lock: true });
    if (e.userId === user.id) c.fail("You cannot act on your own alert", 403);
    const action = c.choice(body.action, ALERT_ACTIONS, "Action");
    const comment = c.text(body.comment, "Comment", 2000, ["warn", "explain"].includes(action));
    const p = await c.policy(tx);
    if (["half-day", "absent"].includes(action)) {
      c.permit(user, "hr_approve");
      await overrideDay(tx, user, e, a.workDate, action === "absent" ? "Absent" : "Half Day", comment || a.title, p);
    }
    if (action === "checkout") {
      const att = await openSession(tx, e.id);
      if (!att) c.fail("The employee is not clocked in", 409);
      await closeSession(tx, att, p, new Date(), "Admin force clock-out", user.id);
      await c.notify(tx, e.userId, "You were clocked out by your admin", att.id, user.id, {
        eventKey: "force_checkout",
        message: comment || a.title,
      });
    }
    if (action === "explain")
      await c.notify(tx, e.userId, `Explanation needed: ${a.title}`, id, user.id, {
        eventKey: "hrm_alert_explain",
        severity: "warning",
        message: comment,
        data: { alertId: id },
      });
    if (action === "warn")
      await c.notify(tx, e.userId, "Warning from HR", id, user.id, {
        eventKey: "hrm_warning",
        severity: "warning",
        message: comment,
      });
    const saved = await c.update(tx, "hrm_alerts", id, {
      status: action === "explain" ? "Explanation Requested" : "Resolved",
      action,
      actionBy: user.id,
      actionAt: new Date(),
      comment,
      updatedAt: new Date(),
    });
    await c.audit(tx, user, "alerts", id, action, a, saved, e.id);
    return saved;
  }, db);
}
async function override(user, body, db = null) {
  c.permit(user, "hr_approve");
  c.allow(body, ["employeeId", "workDate", "status", "comment"]);
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, body.employeeId, { lock: true });
    if (e.userId === user.id) c.fail("HR attendance edits require another authorized reviewer", 403);
    const p = await c.policy(tx);
    const date = c.date(body.workDate);
    if (date > c.today(p)) c.fail("Future attendance cannot be overridden");
    const status = c.choice(body.status, [
      "Present",
      "WFH",
      "Business Visit",
      "Half Day",
      "Absent",
      "Leave",
      "Holiday",
      "Week Off",
      "Comp Off",
    ]);
    const saved = await overrideDay(tx, user, e, date, status, c.text(body.comment, "Reason", 1000, true), p);
    await tx.query(
      "UPDATE hrm_alerts SET status='Resolved',action='override',action_by=$3,action_at=now(),comment=$4,updated_at=now() WHERE employee_id=$1 AND work_date=$2 AND kind='absent' AND status<>'Resolved'",
      [e.id, date, user.id, body.comment],
    );
    return saved;
  }, db);
}
// Admin-only creation or correction of any day's report (employees cannot back-date).
async function adminReport(user, body, db = null) {
  c.permit(user, "hr_approve");
  c.allow(body, ["employeeId", "workDate", "summary", "entries", "remove", "comment"]);
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, body.employeeId, { lock: true });
    if (e.userId === user.id) c.fail("Your own report needs another reviewer", 403);
    const p = await c.policy(tx);
    const workDate = c.date(body.workDate);
    if (workDate > c.today(p) || workDate < e.joiningDate) c.fail("Work date is outside employment or in the future");
    const comment = c.text(body.comment, "Reason for the admin edit", 1000, true);
    if (!Array.isArray(body.entries) || body.entries.length > 50) c.fail("Provide up to 50 entries");
    const report = await reportFor(tx, e.id, workDate, true);
    const before = await entriesFor(tx, report.id);
    for (const id of body.remove || []) {
      if (!before.some((x) => x.id === id)) c.fail("Entry does not belong to this report");
      await tx.query("DELETE FROM hrm_work_entries WHERE id=$1", [id]);
    }
    for (const entry of body.entries) {
      c.allow(entry, ["id", "description", "minutes", "projectId", "billable", "completion", "blocker"]);
      const v = {
        description: c.text(entry.description, "Work done", 4000, true),
        minutes: Math.round(c.number(entry.minutes, "Minutes", 1, 1440)),
        projectId: entry.projectId || null,
        billable: c.boolean(entry.billable ?? false, "Billable"),
        completion: c.number(entry.completion ?? 0, "Completion", 0, 100),
        blocker: c.text(entry.blocker, "Blocker", 2000) || "",
      };
      if (v.projectId) {
        const project = (await tx.query("SELECT client_id FROM projects WHERE id=$1", [v.projectId])).rows[0];
        if (!project) c.fail("Project does not exist");
        v.clientId = project.client_id;
      }
      const old = entry.id && before.find((x) => x.id === entry.id);
      if (entry.id && !old) c.fail("Entry does not belong to this report");
      if (old) {
        // The admin form does not always resend completion/blocker; keep what the employee wrote.
        if (entry.completion === undefined) v.completion = old.completion;
        if (entry.blocker === undefined) v.blocker = old.blocker;
        const unchanged =
          v.description === old.description &&
          v.minutes === Number(old.minutes) &&
          (v.projectId || null) === (old.projectId || null) &&
          Boolean(v.billable) === Boolean(old.billable) &&
          Number(v.completion) === Number(old.completion ?? 0) &&
          (v.blocker || "") === (old.blocker || "");
        if (unchanged) continue;
      }
      if (old)
        await c.update(tx, "hrm_work_entries", old.id, {
          ...v,
          editCount: Number(old.editCount || 0) + 1,
          editedAt: new Date(),
          updatedAt: new Date(),
        });
      else await c.insert(tx, "hrm_work_entries", { ...v, reportId: report.id, source: "admin" });
    }
    const total = (
      await tx.query("SELECT count(*)::int AS n FROM hrm_work_entries WHERE report_id=$1", [report.id])
    ).rows[0].n;
    const saved = await c.update(tx, "hrm_work_reports", report.id, {
      summary: c.text(body.summary, "Summary", 4000) ?? report.summary,
      status: total ? "Approved" : "Draft",
      submittedAt: report.submittedAt || new Date(),
      reviewedBy: user.id,
      reviewedAt: new Date(),
      comment,
      editCount: Number(report.editCount || 0) + 1,
      adminEditedBy: user.id,
      adminEditedAt: new Date(),
      version: report.version + 1,
      updatedAt: new Date(),
    });
    await c.audit(tx, user, "work-reports", report.id, "admin-edited", { report, entries: before }, { report: saved, entries: await entriesFor(tx, report.id), comment }, e.id);
    await c.notify(tx, e.userId, `Admin updated your work report for ${workDate}`, report.id, user.id, {
      eventKey: "work_report_admin_edit",
      message: comment,
    });
    return dayState(tx, e, p, workDate);
  }, db);
}
async function day(user, q = {}, db = c.dbDefault) {
  c.permit(user, "approve", "hr_approve", "view_team", "view_all");
  const e = await c.employee(db, user, q.employeeId);
  const p = await c.policy(db);
  return { employee: { id: e.id, fullName: e.fullName, employeeNumber: e.employeeNumber }, ...(await dayState(db, e, p, c.date(q.date || c.today(p)))) };
}
async function live(user, db = c.dbDefault) {
  c.permit(user, "approve", "hr_approve", "view_team", "view_all");
  const p = await c.policy(db);
  const dayKey = c.today(p);
  const now = new Date();
  const values = [];
  const s = c.scope(user, values);
  values.push(dayKey);
  const n = values.length;
  const rows = (
    await db.query(
      `SELECT a.*,e.id AS emp_id,e.full_name,e.employee_number,g.name AS designation,
        (SELECT count(*)::int FROM hrm_alerts al WHERE al.employee_id=e.id AND al.work_date=$${n} AND al.status<>'Resolved') AS open_alerts,
        r.id AS report_id,r.status AS report_status,r.edit_count AS report_edits
       FROM hrm_employees e LEFT JOIN master_items g ON g.id=e.designation_id
       LEFT JOIN hrm_attendance a ON a.employee_id=e.id AND a.work_date=$${n}
       LEFT JOIN hrm_work_reports r ON r.employee_id=e.id AND r.work_date=$${n}
       WHERE e.archived_at IS NULL AND e.status IN ('Active','Probation','Confirmed','Notice Period') AND ${s}
       ORDER BY e.full_name LIMIT 500`,
      values,
    )
  ).rows.map(c.camel);
  // One query each for the board's work entries and events, instead of one per employee.
  const reportIds = rows.map((r) => r.reportId).filter(Boolean);
  const attendanceIds = rows.filter((r) => r.id).map((r) => r.id);
  const entriesByReport = new Map();
  if (reportIds.length)
    for (const entry of (
      await db.query(
        "SELECT w.*,p.title AS project_title FROM hrm_work_entries w LEFT JOIN projects p ON p.id=w.project_id WHERE w.report_id=ANY($1::text[]) ORDER BY coalesce(w.slot_start,w.created_at),w.id",
        [reportIds],
      )
    ).rows.map(c.camel)) {
      if (!entriesByReport.has(entry.reportId)) entriesByReport.set(entry.reportId, []);
      entriesByReport.get(entry.reportId).push(entry);
    }
  const eventsByAttendance = new Map();
  if (attendanceIds.length)
    for (const event of (
      await db.query(
        "SELECT attendance_id,kind FROM hrm_attendance_events WHERE attendance_id=ANY($1::text[]) AND kind IN ('slot_missed','exit')",
        [attendanceIds],
      )
    ).rows.map(c.camel)) {
      if (!eventsByAttendance.has(event.attendanceId)) eventsByAttendance.set(event.attendanceId, []);
      eventsByAttendance.get(event.attendanceId).push(event);
    }
  const out = [];
  for (const r of rows) {
    const att = r.id ? r : null;
    const entries = (r.reportId && entriesByReport.get(r.reportId)) || [];
    const lastPing = att?.lastPingAt ? new Date(att.lastPingAt) : null;
    const offline =
      Boolean(att?.jobStartedAt && !att.jobEndedAt && !(att.lunchStartedAt && !att.lunchEndedAt)) &&
      (!lastPing || now - lastPing > p.offlineAfterMinutes * 60000);
    const state = !att
      ? "Not clocked in"
      : !att.checkIn
        ? att.status
        : att.checkOut
          ? "Clocked out"
          : att.lunchStartedAt && !att.lunchEndedAt
            ? "On lunch"
            : att.jobEndedAt
              ? "Reviewing summary"
              : att.jobStartedAt
                ? "Working"
                : "Clocked in";
    out.push({
      employeeId: r.empId,
      fullName: r.fullName,
      employeeNumber: r.employeeNumber,
      designation: r.designation,
      state,
      status: att?.status || null,
      workMode: att?.workMode || null,
      source: att?.source || null,
      offline,
      lastPingAt: att?.lastPingAt || null,
      openAlerts: r.openAlerts,
      reportStatus: r.reportStatus,
      reportEdits: r.reportEdits || 0,
      slot: att?.checkIn && !att.checkOut ? d.slotState(att, entries, p, now) : null,
      summary: att ? d.summarize(att, entries, eventsByAttendance.get(att.id) || [], p, now) : null,
    });
  }
  return { date: dayKey, serverTime: now.toISOString(), policy: publicPolicy(p), rows: out };
}
module.exports = {
  today,
  clockIn,
  job,
  lunch,
  submitSlot,
  editEntry,
  checkOut,
  ping,
  requestHome,
  explainAlert,
  registerDevice,
  removeDevice,
  listGeofences,
  saveOffice,
  geofenceAction,
  listAlerts,
  alertAction,
  override,
  adminReport,
  day,
  live,
  // automation
  openSession,
  closeSession,
  openAlert,
  event,
  events,
  reportFor,
  entriesFor,
  inShift,
};
