const c = require("./core");
const calc = require("./calculations");
const { calendarData } = require("./operations");
// Scheduled runs have no logged-in person. This built-in identity carries only the two HRM
// permissions the daily job needs; its null id leaves created_by/actor columns empty.
const SYSTEM_USER = Object.freeze({
  id: null,
  fullName: "HRM Automation",
  isActive: true,
  isSystem: true,
  permissions: Object.freeze(["hrm.automation", "hrm.view_all"]),
});

async function run(user, db = null) {
  c.permit(user, "automation");
  return c.transaction(async (tx) => {
    const p = await c.policy(tx);
    const day = c.today(p);
    const key = `daily:${day}`;
    await tx.query(
      "SELECT pg_advisory_xact_lock(hashtext('hrm-daily-automation'))",
    );
    const existing = (
      await tx.query(
        "SELECT result FROM hrm_automation_runs WHERE source_key=$1",
        [key],
      )
    ).rows[0];
    if (existing) return { ...existing.result, alreadyRun: true };
    const values = [];
    const scope = c.scope(user, values);
    if (!c.can(user, "view_all"))
      c.fail("Company automation requires company-wide HR access", 403);
    const result = { date: day, notifications: 0, leaveGrants: 0 };
    const types = (
      await tx.query(
        "SELECT * FROM master_items WHERE type='hrm_leave_type' AND is_active=true",
      )
    ).rows.map(c.camel);
    let after = "";
    while (true) {
      const rows = (
        await tx.query(
          `SELECT e.* FROM hrm_employees e WHERE ${scope} AND e.archived_at IS NULL AND e.status IN ('Active','Probation','Confirmed','Notice Period') AND e.id>$${values.length + 1} ORDER BY e.id LIMIT 100`,
          [...values, after],
        )
      ).rows.map(c.camel);
      if (!rows.length) break;
      for (const e of rows) {
        if (e.joiningDate > day || (e.exitDate && e.exitDate < day)) continue;
        await tx.query("SELECT id FROM hrm_employees WHERE id=$1 FOR UPDATE", [
          e.id,
        ]);
        for (const t of types) {
          const policy = t.payload || {};
          if (
            !policy.annualDays ||
            policy.paid === false ||
            (e.status === "Probation" && policy.probationAllowed === false) ||
            (policy.employmentTypeIds?.length &&
              !policy.employmentTypeIds.includes(e.employmentTypeId))
          )
            continue;
          const month = Number(day.slice(5, 7));
          const joinMonth =
            e.joiningDate.slice(0, 4) === day.slice(0, 4)
              ? Number(e.joiningDate.slice(5, 7))
              : 1;
          const entitlement =
            policy.accrual === "monthly"
              ? (Number(policy.annualDays) / 12) *
                Math.max(0, month - joinMonth + 1)
              : (Number(policy.annualDays) * (13 - joinMonth)) / 12;
          const prior = await tx.query(
            "SELECT coalesce(sum(amount),0)::numeric AS total FROM hrm_leave_ledger WHERE employee_id=$1 AND leave_type_id=$2 AND year=$3 AND source_key LIKE 'accrual:%'",
            [e.id, t.id, Number(day.slice(0, 4))],
          );
          const amount = calc.round(entitlement - Number(prior.rows[0].total));
          if (amount > 0) {
            await c.insert(tx, "hrm_leave_ledger", {
              employeeId: e.id,
              leaveTypeId: t.id,
              year: Number(day.slice(0, 4)),
              amount,
              reason: "Configured leave allocation / accrual",
              sourceKey: `accrual:${e.id}:${t.id}:${day}`,
              createdBy: user.id,
            });
            result.leaveGrants++;
          }
          if (policy.carryForward) {
            const year = Number(day.slice(0, 4));
            const balance = (
              await tx.query(
                "SELECT coalesce(sum(amount),0)::numeric AS total FROM hrm_leave_ledger WHERE employee_id=$1 AND leave_type_id=$2 AND year=$3",
                [e.id, t.id, year - 1],
              )
            ).rows[0].total;
            const carry = Math.max(
              0,
              Math.min(Number(policy.carryForwardLimit || 0), Number(balance)),
            );
            if (carry)
              await tx.query(
                "INSERT INTO hrm_leave_ledger(id,employee_id,leave_type_id,year,amount,reason,source_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(source_key) DO NOTHING",
                [
                  require("../../utils/format").createId("leave"),
                  e.id,
                  t.id,
                  year,
                  carry,
                  "Configured carry forward",
                  `carry:${e.id}:${t.id}:${year}`,
                  user.id,
                ],
              );
          }
        }
        const yesterday = new Date(Date.parse(day) - 86400000)
          .toISOString()
          .slice(0, 10);
        const available = calc.calendar(
          e,
          yesterday,
          yesterday,
          p,
          await calendarData(tx, e.id, yesterday, yesterday),
        )[0];
        const report = await tx.query(
          "SELECT id FROM hrm_work_reports WHERE employee_id=$1 AND work_date=$2 AND status IN ('Submitted','Reviewed','Approved')",
          [e.id, yesterday],
        );
        if (p.reportMandatory && available.hours > 0 && !report.rowCount) {
          await c.notify(
            tx,
            e.userId,
            "Daily work report is missing",
            e.id,
            user.id,
          );
          result.notifications++;
        }
        const limit = new Date(Date.parse(day) + p.reminderDays * 86400000)
          .toISOString()
          .slice(0, 10);
        const docs = await tx.query(
          "SELECT id FROM hrm_documents WHERE employee_id=$1 AND expires_on BETWEEN $2 AND $3",
          [e.id, day, limit],
        );
        if (
          docs.rowCount ||
          (e.probationEnd &&
            e.probationEnd >= day &&
            e.probationEnd <= limit) ||
          (e.contractEnd && e.contractEnd >= day && e.contractEnd <= limit)
        ) {
          await c.notify(
            tx,
            e.userId,
            "An HR date or document needs attention",
            e.id,
            user.id,
          );
          result.notifications++;
        }
      }
      after = rows[rows.length - 1].id;
    }
    await tx.query(
      "INSERT INTO hrm_automation_runs(source_key,result) VALUES($1,$2)",
      [key, JSON.stringify(result)],
    );
    await c.audit(tx, user, "automation", key, "completed", null, result);
    return result;
  }, db);
}
// ── realtime workday automation (system actor, every few minutes) ───────────
const d = require("./daylogic");
async function hasEvent(tx, attendanceId, kind, key) {
  return (
    await tx.query(
      "SELECT 1 FROM hrm_attendance_events WHERE attendance_id=$1 AND kind=$2 AND details->>'key'=$3 LIMIT 1",
      [attendanceId, kind, key],
    )
  ).rowCount;
}
async function sessionTick(attendanceId, now, tickPolicy = null) {
  const wd = require("./workday");
  return c.transaction(async (tx) => {
    const att = c.camel(
      (
        await tx.query(
          "SELECT * FROM hrm_attendance WHERE id=$1 AND check_in IS NOT NULL AND check_out IS NULL FOR UPDATE SKIP LOCKED",
          [attendanceId],
        )
      ).rows[0],
    );
    if (!att) return;
    const e = c.camel((await tx.query("SELECT * FROM hrm_employees WHERE id=$1", [att.employeeId])).rows[0]);
    const p = tickPolicy || (await c.policy(tx));
    if (att.autoCheckoutAt && new Date(att.autoCheckoutAt) <= now) {
      await wd.closeSession(tx, att, p, att.autoCheckoutAt, "Half-day leave start time reached");
      await c.notify(tx, e.userId, "Half-day leave started — you were clocked out", att.id, null, {
        eventKey: "auto_checkout",
      });
      return;
    }
    const running = att.jobStartedAt && !att.jobEndedAt;
    const onLunch = att.lunchStartedAt && !att.lunchEndedAt;
    if (running && !onLunch) {
      const report = await wd.reportFor(tx, e.id, att.workDate);
      const s = d.slotState(att, await wd.entriesFor(tx, report?.id), p, now);
      if (now >= new Date(s.dueAt) && !(await hasEvent(tx, att.id, "slot_prompt", s.dueAt))) {
        await wd.event(tx, att, "slot_prompt", {}, { key: s.dueAt });
        await c.notify(tx, e.userId, "Time to submit your work report", att.id, null, {
          eventKey: "slot_due",
          message: `What did you work on in the last ${p.reportIntervalMinutes} minutes?`,
          tag: "slot",
          data: { dueAt: s.dueAt },
        });
      }
      if (now > new Date(s.graceEndsAt) && !(await hasEvent(tx, att.id, "slot_missed", s.dueAt))) {
        await wd.event(tx, att, "slot_missed", {}, { key: s.dueAt });
        await c.notify(tx, e.userId, "Work report overdue — idle time is being counted", att.id, null, {
          eventKey: "slot_missed",
          severity: "warning",
          tag: "slot",
        });
      }
      const shift = att.shiftSnapshot || {};
      const silent = !att.lastPingAt || now - new Date(att.lastPingAt) > p.offlineAfterMinutes * 60000;
      if (silent && wd.inShift(now, shift, p) && (await wd.openAlert(
        tx,
        e,
        att,
        "offline",
        `${e.fullName}'s app has been offline since ${att.lastPingAt ? calc.timeParts(att.lastPingAt, p.timezone).hour + ":" + calc.timeParts(att.lastPingAt, p.timezone).minute : "clock-in"}`,
        { lastPingAt: att.lastPingAt },
        { severity: "warning" },
      )))
        await wd.event(tx, att, "offline", {}, { key: String(att.lastPingAt) });
      const lunchKey = `lunch:${att.workDate}`;
      if (
        !att.lunchStartedAt &&
        d.inWindow(now, p.lunchWindowStart, p.lunchWindowEnd, p.timezone) &&
        !(await hasEvent(tx, att.id, "lunch_prompt", lunchKey))
      ) {
        await wd.event(tx, att, "lunch_prompt", {}, { key: lunchKey });
        await c.notify(tx, e.userId, "Lunch time", att.id, null, {
          eventKey: "lunch_due",
          message: `Start lunch in the app before ${p.lunchWindowEnd}. Allowed: ${p.lunchMaxMinutes} min.`,
          tag: "lunch",
        });
      }
    }
    if (onLunch) {
      const end = new Date(new Date(att.lunchStartedAt).getTime() + p.lunchMaxMinutes * 60000);
      if (now >= end && !(await hasEvent(tx, att.id, "lunch_end_prompt", att.workDate))) {
        await wd.event(tx, att, "lunch_end_prompt", {}, { key: att.workDate });
        await c.notify(tx, e.userId, "Lunch time is over", att.id, null, {
          eventKey: "lunch_over",
          severity: "warning",
          message: "Tap 'End lunch' to resume work. Extra time is flagged.",
          tag: "lunch",
        });
      }
    }
  });
}
// After the report deadline: close forgotten sessions, auto-submit drafts that
// have entries, and mark days with no report Absent (admins can override).
async function closeDay(day, now) {
  const wd = require("./workday");
  return c.transaction(async (tx) => {
    const p = await c.policy(tx);
    const key = `deadline:${day}`;
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
    if ((await tx.query("SELECT 1 FROM hrm_automation_runs WHERE source_key=$1", [key])).rowCount)
      return null;
    const result = { date: day, closed: 0, submitted: 0, absent: 0, failed: 0 };
    const people = (
      await tx.query(
        "SELECT * FROM hrm_employees WHERE archived_at IS NULL AND status IN ('Active','Probation','Confirmed','Notice Period') AND joining_date<=$1 AND (exit_date IS NULL OR exit_date>=$1) ORDER BY id",
        [day],
      )
    ).rows.map(c.camel);
    const deadline = new Date(calc.localInstant(day, p.reportDeadline, p.timezone));
    const processEmployee = async (e) => {
      const available = calc.calendar(e, day, day, p, await calendarData(tx, e.id, day, day))[0];
      let att = c.camel(
        (await tx.query("SELECT * FROM hrm_attendance WHERE employee_id=$1 AND work_date=$2 FOR UPDATE", [e.id, day])).rows[0],
      );
      if (att?.checkIn && !att.checkOut) {
        const at = att.jobEndedAt || att.lastPingAt || deadline;
        att = await wd.closeSession(tx, att, p, at, "Report deadline reached — auto clock-out");
        result.closed++;
      }
      // HR-marked days (Comp Off, WFH, Half Day...) and earlier overrides are never auto-changed.
      if (available.hours <= 0 || att?.override || att?.source === "hr") return;
      const report = await wd.reportFor(tx, e.id, day);
      const entries = await wd.entriesFor(tx, report?.id);
      if (report && entries.length && ["Draft", "Revision Requested"].includes(report.status)) {
        await c.update(tx, "hrm_work_reports", report.id, {
          status: p.requireReportApproval ? "Submitted" : "Approved",
          submittedAt: now,
          version: report.version + 1,
          updatedAt: now,
        });
        await c.audit(tx, { id: null }, "work-reports", report.id, "auto-submitted", report, null, e.id);
        result.submitted++;
        return;
      }
      if (entries.length || !p.absentIfNoReport) return;
      const saved = att
        ? await c.update(tx, "hrm_attendance", att.id, {
            status: "Absent",
            override: JSON.stringify({ auto: true, from: att.status, to: "Absent", at: now, comment: "No work report by the deadline" }),
            updatedAt: now,
          })
        : await c.insert(tx, "hrm_attendance", {
            employeeId: e.id,
            workDate: day,
            status: "Absent",
            source: "automation",
            override: JSON.stringify({ auto: true, to: "Absent", at: now, comment: "No work report by the deadline" }),
          });
      await c.audit(tx, { id: null }, "attendance", saved.id, "auto-absent", att, saved, e.id);
      await c.notify(tx, e.userId, `Marked Absent for ${day}: no work report submitted`, saved.id, null, {
        eventKey: "auto_absent",
        severity: "critical",
        message: "Back-dated reports are not allowed. Contact HR if this is wrong.",
      });
      await wd.openAlert(tx, e, saved, "absent", `${e.fullName} marked Absent for ${day} (no work report)`, {}, {
        severity: "critical",
        message: "Override the attendance from HRM if this should not be absent.",
        workDate: day,
      });
      result.absent++;
    };
    // One employee's failure must not roll back everyone else's day.
    for (const e of people) {
      const hookMark = tx.afterCommit ? tx.afterCommit.length : 0;
      await tx.query("SAVEPOINT hrm_close_employee");
      try {
        await processEmployee(e);
        await tx.query("RELEASE SAVEPOINT hrm_close_employee");
      } catch (error) {
        await tx.query("ROLLBACK TO SAVEPOINT hrm_close_employee");
        if (tx.afterCommit) tx.afterCommit.length = hookMark;
        result.failed++;
        console.error(`HRM end-of-day failed for employee ${e.id}:`, error.message);
      }
    }
    await tx.query("INSERT INTO hrm_automation_runs(source_key,result) VALUES($1,$2)", [key, JSON.stringify(result)]);
    return result;
  });
}
// A session opened after its day's deadline run (late or night shift) is never reached by closeDay,
// and an open session blocks the next clock-in. Close anything still open from an earlier day.
async function closeStaleSessions(p, now) {
  const wd = require("./workday");
  const today = c.today(p, now);
  const stale = (
    await c.dbDefault.query(
      "SELECT id, work_date FROM hrm_attendance WHERE check_in IS NOT NULL AND check_out IS NULL AND work_date < $1",
      [today],
    )
  ).rows;
  let closed = 0;
  for (const row of stale) {
    const day = String(row.work_date).slice(0, 10);
    const deadline = new Date(calc.localInstant(day, p.reportDeadline, p.timezone));
    if (now < deadline) continue;
    try {
      await c.transaction(async (tx) => {
        const att = c.camel((await tx.query("SELECT * FROM hrm_attendance WHERE id=$1 FOR UPDATE", [row.id])).rows[0]);
        if (!att || !att.checkIn || att.checkOut) return;
        await wd.closeSession(tx, att, p, att.jobEndedAt || att.lastPingAt || deadline, "Report deadline reached — auto clock-out");
        closed++;
      });
    } catch (error) {
      console.error(`HRM stale session close failed for ${row.id}:`, error.message);
    }
  }
  return closed;
}
let ticking = false;
async function realtime(now = new Date()) {
  if (ticking) return { skipped: true };
  ticking = true;
  try {
    const p = await c.policy();
    const sessions = (
      await c.dbDefault.query("SELECT id FROM hrm_attendance WHERE check_in IS NOT NULL AND check_out IS NULL")
    ).rows;
    for (const s of sessions)
      await sessionTick(s.id, now, p).catch((e) => console.error("HRM session tick failed:", e.message));
    const staleClosed = await closeStaleSessions(p, now);
    const today = c.today(p, now);
    const yesterday = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10);
    const closed = [];
    for (const day of [yesterday, today])
      if (now >= new Date(calc.localInstant(day, p.reportDeadline, p.timezone) + 60000))
        closed.push(await closeDay(day, now));
    return { sessions: sessions.length, staleClosed, closed: closed.filter(Boolean) };
  } finally {
    ticking = false;
  }
}
function schedule() {
  if (String(process.env.HRM_AUTOMATION_ENABLED).toLowerCase() !== "true")
    return;
  const cron = require("node-cron");
  cron.schedule(
    process.env.HRM_REALTIME_CRON || "*/5 * * * *",
    () =>
      realtime().catch((error) =>
        console.error("HRM realtime automation failed:", error.message),
      ),
    { timezone: process.env.HRM_TIMEZONE || "Asia/Kolkata" },
  );
  cron.schedule(
    process.env.HRM_AUTOMATION_CRON || "30 1 * * *",
    async () => {
      try {
        const p = await c.policy();
        if (!p.automationEnabled) return;
        await run(SYSTEM_USER);
      } catch (error) {
        console.error("HRM automation failed:", error.message);
      }
    },
    { timezone: process.env.HRM_TIMEZONE || "Asia/Kolkata" },
  );
}
module.exports = { run, schedule, SYSTEM_USER, realtime, closeDay, sessionTick };
