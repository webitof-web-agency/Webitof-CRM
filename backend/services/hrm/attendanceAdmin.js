const c = require("./core");
async function mark(user, body, db = null) {
  c.permit(user, "hr_approve");
  c.allow(body, ["employeeId", "workDate", "status", "reason"]);
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, body.employeeId, { lock: true });
    if (e.userId === user.id)
      c.fail("HR attendance edits require another authorized reviewer", 403);
    const p = await c.policy(tx);
    const date = c.date(body.workDate);
    if (
      date > c.today(p) ||
      date < e.joiningDate ||
      (e.exitDate && date > e.exitDate)
    )
      c.fail("Attendance date is outside employment or in the future");
    const locked = await tx.query(
      "SELECT pe.id FROM hrm_payroll_entries pe JOIN hrm_payroll_runs r ON r.id=pe.run_id WHERE pe.employee_id=$1 AND r.start_date<=$2 AND r.end_date>=$2",
      [e.id, date],
    );
    if (locked.rowCount) c.fail("Payroll has locked this date", 409);
    const leave = await tx.query(
      "SELECT id FROM hrm_requests WHERE employee_id=$1 AND kind='leave' AND status='Approved' AND start_date<=$2 AND end_date>=$2",
      [e.id, date],
    );
    if (leave.rowCount) c.fail("Use the leave workflow for this date", 409);
    const old = c.camel(
      (
        await tx.query(
          "SELECT * FROM hrm_attendance WHERE employee_id=$1 AND work_date=$2 FOR UPDATE",
          [e.id, date],
        )
      ).rows[0],
    );
    if (old?.checkIn || old?.lockedAt)
      c.fail("Use regularization to correct existing clocked attendance", 409);
    const values = {
      employeeId: e.id,
      workDate: date,
      status: c.choice(body.status, [
        "Absent",
        "Holiday",
        "Week Off",
        "Comp Off",
        "Business Visit",
        "Half Day",
        "WFH",
        "Present",
      ]),
      source: "hr",
    };
    const saved = old
      ? await c.update(tx, "hrm_attendance", old.id, {
          ...values,
          updatedAt: new Date(),
        })
      : await c.insert(tx, "hrm_attendance", values);
    await c.audit(
      tx,
      user,
      "attendance",
      saved.id,
      "marked",
      old,
      { ...saved, reason: c.text(body.reason, "Reason", 1000, true) },
      e.id,
    );
    return saved;
  }, db);
}
module.exports = { mark };
