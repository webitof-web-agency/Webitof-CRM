const c = require("./core");
const calc = require("./calculations");
const { calendarData } = require("./operations");
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
function schedule() {
  if (String(process.env.HRM_AUTOMATION_ENABLED).toLowerCase() !== "true")
    return;
  const cron = require("node-cron");
  cron.schedule(
    process.env.HRM_AUTOMATION_CRON || "30 1 * * *",
    async () => {
      try {
        const p = await c.policy();
        if (!p.automationEnabled) return;
        const id = process.env.HRM_AUTOMATION_USER_ID;
        if (!id) return;
        const user = await require("../auth.service").getUserAccessProfile(id);
        if (user?.isActive) await run(user);
      } catch (error) {
        console.error("HRM automation failed:", error.message);
      }
    },
    { timezone: process.env.HRM_TIMEZONE || "Asia/Kolkata" },
  );
}
module.exports = { run, schedule };
