const c = require("./core");
const calc = require("./calculations");
const { calendarData } = require("./operations");
async function salary(user, body, db = null) {
  c.permit(user, "manage_salary");
  c.allow(body, [
    "employeeId",
    "effectiveDate",
    "monthlyCost",
    "currency",
    "components",
    "reason",
  ]);
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, body.employeeId, { lock: true });
    const effectiveDate = c.date(body.effectiveDate);
    if (effectiveDate < e.joiningDate)
      c.fail("Salary effective date precedes employment");
    const last = (
      await tx.query(
        "SELECT max(effective_date)::text AS date FROM hrm_salary_history WHERE employee_id=$1",
        [e.id],
      )
    ).rows[0].date;
    if (last && effectiveDate <= last)
      c.fail("Append a salary revision after the latest effective date");
    const locked = await tx.query(
      "SELECT p.id FROM hrm_payroll_runs p JOIN hrm_payroll_entries e ON e.run_id=p.id WHERE e.employee_id=$1 AND p.end_date>=$2",
      [e.id, effectiveDate],
    );
    if (locked.rowCount)
      c.fail("Salary changes cannot alter locked payroll periods", 409);
    const components = body.components || [];
    if (!Array.isArray(components) || components.length > 50)
      c.fail("Provide up to 50 salary components");
    for (const component of components) {
      c.allow(component, ["name", "type", "amount"]);
      c.text(component.name, "Component name", 100, true);
      c.choice(component.type, ["earning", "deduction", "employer"]);
      c.number(component.amount, "Component monthly amount", 0, 1e8);
    }
    const currency = body.currency || (await c.policy(tx)).currency;
    if (!/^[A-Z]{3}$/.test(currency)) c.fail("Use a three-letter currency");
    const record = await c.insert(tx, "hrm_salary_history", {
      employeeId: e.id,
      effectiveDate,
      monthlyCost: c.number(body.monthlyCost, "Monthly employer cost", 0, 1e8),
      currency,
      components: JSON.stringify(components),
      reason: c.text(body.reason, "Revision reason", 1000, true),
      createdBy: user.id,
    });
    await c.audit(
      tx,
      user,
      "salary-history",
      record.id,
      "created",
      null,
      record,
      e.id,
      true,
    );
    return record;
  }, db);
}
function monthBounds(day) {
  const start = `${day.slice(0, 7)}-01`;
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return { start, end: d.toISOString().slice(0, 10) };
}
async function draft(user, body, db = null) {
  c.permit(user, "payroll", "view_salary");
  if (!c.can(user, "payroll") || !c.can(user, "view_salary"))
    c.fail("Payroll preparation and salary access are both required", 403);
  c.allow(body, ["startDate", "endDate", "employeeIds"]);
  return c.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext('hrm-payroll'))");
    const p = await c.policy(tx);
    const { start, end } = c.range(body, p);
    const bounds = monthBounds(start);
    if (start !== bounds.start || end !== bounds.end || end >= c.today(p))
      c.fail("Payroll must cover one completed calendar month");
    if (
      !Array.isArray(body.employeeIds) ||
      !body.employeeIds.length ||
      body.employeeIds.length > 500
    )
      c.fail("Select between 1 and 500 employees");
    const run = await c.insert(tx, "hrm_payroll_runs", {
      startDate: start,
      endDate: end,
      policySnapshot: JSON.stringify(p),
      createdBy: user.id,
    });
    const entries = [];
    for (const employeeId of [...new Set(body.employeeIds)]) {
      const e = await c.employee(tx, user, employeeId, { lock: true });
      const overlap = await tx.query(
        "SELECT p.id FROM hrm_payroll_runs p JOIN hrm_payroll_entries pe ON pe.run_id=p.id WHERE pe.employee_id=$1 AND p.start_date<=$3 AND p.end_date>=$2",
        [e.id, start, end],
      );
      if (overlap.rowCount)
        c.fail(`${e.fullName} already has payroll for this period`, 409);
      const pending = await tx.query(
        "SELECT id FROM hrm_requests WHERE employee_id=$1 AND kind IN ('leave','regularization') AND status IN ('Submitted','Manager Approved') AND start_date<=$3 AND end_date>=$2",
        [e.id, start, end],
      );
      if (pending.rowCount)
        c.fail(`Resolve pending leave/attendance for ${e.fullName}`);
      const history = (
        await tx.query(
          "SELECT * FROM hrm_salary_history WHERE employee_id=$1 AND effective_date<=$2 ORDER BY effective_date",
          [e.id, end],
        )
      ).rows.map(c.camel);
      const data = await calendarData(tx, e.id, start, end);
      const scheduled = calc.calendar(
        { ...e, joiningDate: start, exitDate: null },
        start,
        end,
        p,
        { ...data, leave: [] },
      );
      const denominator = scheduled.reduce((s, d) => s + d.hours, 0);
      if (!denominator) c.fail("No scheduled hours in this payroll month");
      const attendance = (
        await tx.query(
          "SELECT * FROM hrm_attendance WHERE employee_id=$1 AND work_date BETWEEN $2 AND $3 FOR UPDATE",
          [e.id, start, end],
        )
      ).rows.map(c.camel);
      let gross = 0,
        deductions = 0;
      const dayCalculations = [];
      for (const d of scheduled.filter(
        (d) =>
          d.hours > 0 &&
          d.date >= e.joiningDate &&
          (!e.exitDate || d.date <= e.exitDate),
      )) {
        const s = calc.effective(history, d.date);
        if (!s)
          c.fail(`Missing effective salary for ${e.fullName} on ${d.date}`);
        if (s.currency !== p.currency)
          c.fail("Payroll and salary currencies must match");
        const a = attendance.find((a) => a.workDate === d.date);
        const leaves = data.leave.filter(
          (l) => l.startDate <= d.date && l.endDate >= d.date,
        );
        if (!a && !leaves.length)
          c.fail(
            `Resolve attendance for ${e.fullName} on ${d.date} before payroll`,
          );
        if (a?.checkIn && !a.checkOut)
          c.fail(`Missing checkout for ${e.fullName} on ${d.date}`);
        const unpaid = Math.min(
          1,
          leaves
            .filter((l) => l.details.paid === false)
            .reduce((v, l) => v + Number(l.details.fraction || 1), 0),
        );
        const paidFraction =
          a?.status === "Absent"
            ? 0
            : a?.status === "Half Day" && !leaves.length
              ? 0.5
              : 1 - unpaid;
        const earnings = s.components.filter((x) => x.type === "earning");
        const base = earnings.length
          ? earnings.reduce((v, x) => v + Number(x.amount), 0)
          : Number(s.monthlyCost);
        const monthlyDeduction = s.components
          .filter((x) => x.type === "deduction")
          .reduce((v, x) => v + Number(x.amount), 0);
        const weight = (d.hours / denominator) * paidFraction;
        gross += base * weight;
        deductions += monthlyDeduction * weight;
        dayCalculations.push({
          date: d.date,
          salaryHistoryId: s.id,
          scheduledHours: d.hours,
          paidFraction,
          gross: calc.round(base * weight),
          deductions: calc.round(monthlyDeduction * weight),
        });
      }
      if (!dayCalculations.length)
        c.fail(`${e.fullName} has no employment in the selected month`);
      const adjustments = (
        await tx.query(
          "SELECT * FROM hrm_records WHERE kind='payroll_adjustment' AND employee_id=$1 AND status='Approved' AND start_date BETWEEN $2 AND $3 AND archived_at IS NULL FOR UPDATE",
          [e.id, start, end],
        )
      ).rows.map(c.camel);
      for (const a of adjustments) {
        if (a.details.type === "earning") gross += Number(a.details.amount);
        else deductions += Number(a.details.amount);
      }
      gross = calc.round(gross);
      deductions = calc.round(deductions);
      if (deductions > gross)
        c.fail(`Deductions exceed gross pay for ${e.fullName}`);
      const entry = await c.insert(tx, "hrm_payroll_entries", {
        runId: run.id,
        employeeId: e.id,
        gross,
        deductions,
        net: calc.round(gross - deductions),
        currency: p.currency,
        calculation: JSON.stringify({
          employeeName: e.fullName,
          employeeNumber: e.employeeNumber,
          denominatorHours: denominator,
          days: dayCalculations,
          adjustmentIds: adjustments.map((x) => x.id),
          basis:
            "Scheduled monthly hours, effective-dated earnings and explicit leave/attendance",
        }),
      });
      entries.push(entry);
      await tx.query(
        "UPDATE hrm_attendance SET locked_at=now() WHERE employee_id=$1 AND work_date BETWEEN $2 AND $3",
        [e.id, start, end],
      );
    }
    await c.audit(
      tx,
      user,
      "payroll",
      run.id,
      "drafted",
      null,
      { employeeCount: entries.length, startDate: start, endDate: end },
      null,
      true,
    );
    return { ...run, entries };
  }, db);
}
async function action(user, id, body, db = null) {
  c.allow(body, ["action"]);
  return c.transaction(async (tx) => {
    const action = c.choice(body.action, ["review", "approve", "post", "void"]);
    if (action === "post") c.permit(user, "finance");
    else if (action === "approve") c.permit(user, "approve_payroll");
    else if (action === "void") c.permit(user, "payroll", "approve_payroll");
    else c.permit(user, "payroll");
    c.permit(user, "view_salary");
    const run = c.camel(
      (
        await tx.query(
          "SELECT * FROM hrm_payroll_runs WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0],
    );
    if (!run) c.fail("Payroll run not found", 404);
    const entries = (
      await tx.query("SELECT * FROM hrm_payroll_entries WHERE run_id=$1", [id])
    ).rows.map(c.camel);
    // Load the run's employees directly. Going through the scoped c.employee() here made one archived
    // or out-of-scope employee fail review/approve/post for the whole run.
    const people = new Map(
      (
        await tx.query("SELECT * FROM hrm_employees WHERE id=ANY($1::text[])", [
          [...new Set(entries.map((x) => x.employeeId))],
        ])
      ).rows
        .map(c.camel)
        .map((x) => [x.id, x]),
    );
    const person = (row) => people.get(row.employeeId) || c.fail("Employee record is missing", 409);
    for (const row of entries) {
      const e = person(row);
      if (action === "approve" && e.userId === user.id)
        c.fail(
          "An approver cannot approve payroll containing their own pay",
          403,
        );
    }
    if (
      (action === "review" && run.status !== "Draft") ||
      (action === "approve" && run.status !== "Reviewed") ||
      (action === "post" && run.status !== "Approved") ||
      (action === "void" && !["Draft", "Reviewed"].includes(run.status))
    )
      c.fail("Invalid payroll transition or already processed", 409);
    if (action === "approve" && run.createdBy === user.id)
      c.fail("Payroll must be approved by a different authorized user", 403);
    if (action === "void") {
      // Only before approval: nothing is posted yet, so deleting the entries and unlocking the month
      // fully undoes the draft. The run stays as Voided with its totals in the audit trail.
      for (const entry of entries)
        await tx.query(
          "UPDATE hrm_attendance SET locked_at=NULL WHERE employee_id=$1 AND work_date BETWEEN $2 AND $3",
          [entry.employeeId, run.startDate, run.endDate],
        );
      await tx.query("DELETE FROM hrm_payroll_entries WHERE run_id=$1", [id]);
      const voided = await c.update(tx, "hrm_payroll_runs", id, { status: "Voided" });
      await c.audit(
        tx,
        user,
        "payroll",
        id,
        "voided",
        { run, employeeCount: entries.length, gross: calc.round(entries.reduce((n, x) => n + Number(x.gross || 0), 0)) },
        voided,
        null,
        true,
      );
      return voided;
    }
    if (action === "post")
      for (const entry of entries) {
        if (entry.expenseId) continue;
        const e = person(entry);
        const expense = await c.insert(tx, "expenses", {
          expenseDate: run.endDate,
          vendor: e.fullName,
          payeeName: e.fullName,
          payeeType: "Employee",
          employeeId: e.userId,
          payeeId: e.userId || e.id,
          expenseType: "Employee Salary",
          periodStart: run.startDate,
          periodEnd: run.endDate,
          amountBeforeGst: entry.gross,
          totalAmount: entry.gross,
          balanceDue: entry.gross,
          status: "Approved",
          approvalStatus: "Approved",
          paymentStatus: "Unpaid",
          notes: `Approved payroll ${e.employeeNumber}`,
          payload: JSON.stringify({
            hrmPayrollEntryId: entry.id,
            netPay: entry.net,
            deductions: entry.deductions,
          }),
        });
        await c.update(tx, "hrm_payroll_entries", entry.id, {
          expenseId: expense.id,
        });
      }
    const saved = await c.update(tx, "hrm_payroll_runs", id, {
      status: { review: "Reviewed", approve: "Approved", post: "Posted" }[
        action
      ],
      ...(action === "approve"
        ? { approvedBy: user.id, approvedAt: new Date() }
        : {}),
    });
    if (action === "approve")
      for (const entry of entries) {
        if (entry.calculation.adjustmentIds.length)
          await tx.query(
            "UPDATE hrm_records SET status='Processed',updated_at=now() WHERE id=ANY($1::text[])",
            [entry.calculation.adjustmentIds],
          );
        const e = person(entry);
        await c.notify(tx, e.userId, "Payslip available", entry.id, user.id);
      }
    await c.audit(tx, user, "payroll", id, action, run, saved, null, true);
    return saved;
  }, db);
}
async function payslip(user, id, db = c.dbDefault) {
  const r = c.camel(
    (
      await db.query(
        "SELECT pe.*,p.status,p.start_date,p.end_date FROM hrm_payroll_entries pe JOIN hrm_payroll_runs p ON p.id=pe.run_id WHERE pe.id=$1",
        [id],
      )
    ).rows[0],
  );
  if (!r) c.fail("Payslip not found", 404);
  const e = await c.employee(db, user, r.employeeId);
  if (e.userId !== user.id) c.permit(user, "view_salary");
  if (
    e.userId === user.id &&
    !c.can(user, "view_salary") &&
    !["Approved", "Posted"].includes(r.status)
  )
    c.fail("Payslip not yet approved", 404);
  return r;
}
// This month's payroll so far, worked out the same way as a draft run (scheduled hours,
// effective-dated salary, attendance and leave) but read-only: nothing is saved or locked, and
// days not yet resolved are counted instead of failing. `earned` covers 1st..today, `projected`
// adds the remaining working days as fully paid.
async function live(user, q = {}, db = c.dbDefault) {
  c.permit(user, "view_salary");
  const p = await c.policy(db);
  const today = c.today(p);
  const { start, end } = monthBounds(today);
  const values = [];
  const scope = c.scope(user, values);
  values.push(end, start);
  const employees = (
    await db.query(
      `SELECT e.* FROM hrm_employees e WHERE ${scope} AND e.archived_at IS NULL AND e.status<>'Draft'
       AND e.joining_date<=$${values.length - 1} AND (e.exit_date IS NULL OR e.exit_date>=$${values.length})
       ORDER BY e.full_name LIMIT 500`,
      values,
    )
  ).rows.map(c.camel);
  const rows = [];
  for (const e of employees) {
    const history = (
      await db.query("SELECT * FROM hrm_salary_history WHERE employee_id=$1 AND effective_date<=$2 ORDER BY effective_date", [e.id, end])
    ).rows.map(c.camel);
    const data = await calendarData(db, e.id, start, end);
    const scheduled = calc.calendar({ ...e, joiningDate: start, exitDate: null }, start, end, p, { ...data, leave: [] });
    const denominator = scheduled.reduce((s, d) => s + d.hours, 0);
    const attendance = (
      await db.query("SELECT * FROM hrm_attendance WHERE employee_id=$1 AND work_date BETWEEN $2 AND $3", [e.id, start, end])
    ).rows.map(c.camel);
    const counts = { workingDays: 0, elapsedDays: 0, present: 0, halfDays: 0, absent: 0, paidLeave: 0, unpaidLeave: 0, unmarked: 0, remaining: 0, holidays: 0 };
    const unmarkedDates = [];
    const sums = { earnedGross: 0, earnedDeductions: 0, projectedGross: 0, projectedDeductions: 0 };
    let current = null;
    for (const d of scheduled) {
      if (d.date < e.joiningDate || (e.exitDate && d.date > e.exitDate)) continue;
      if (d.kind === "Holiday") counts.holidays++;
      if (!(d.hours > 0)) continue;
      counts.workingDays++;
      // Days are counted even without a salary on record; their amount is then 0.
      const s = calc.effective(history, d.date);
      if (s) current = s;
      const earnings = (s?.components || []).filter((x) => x.type === "earning");
      const base = !s ? 0 : earnings.length ? earnings.reduce((v, x) => v + Number(x.amount), 0) : Number(s.monthlyCost);
      const monthlyDeduction = (s?.components || []).filter((x) => x.type === "deduction").reduce((v, x) => v + Number(x.amount), 0);
      const share = denominator ? d.hours / denominator : 0;
      const a = attendance.find((x) => x.workDate === d.date);
      const leaves = data.leave.filter((l) => l.startDate <= d.date && l.endDate >= d.date);
      const future = d.date > today || (d.date === today && !a?.checkIn && !leaves.length);
      let paidFraction = 1;
      if (future) {
        counts.remaining++;
      } else {
        counts.elapsedDays++;
        const unpaid = Math.min(1, leaves.filter((l) => l.details.paid === false).reduce((v, l) => v + Number(l.details.fraction || 1), 0));
        if (a?.status === "Absent") {
          paidFraction = 0;
          counts.absent++;
        } else if (a?.status === "Half Day" && !leaves.length) {
          paidFraction = 0.5;
          counts.halfDays++;
        } else if (!a && !leaves.length) {
          // Unresolved: nothing recorded yet. Not earned until HR marks it; projected as paid.
          paidFraction = 0;
          counts.unmarked++;
          unmarkedDates.push(d.date);
        } else {
          paidFraction = 1 - unpaid;
          if (leaves.length) {
            if (unpaid) counts.unpaidLeave += unpaid;
            if (unpaid < 1) counts.paidLeave += 1 - unpaid;
          } else counts.present++;
        }
        sums.earnedGross += base * share * paidFraction;
        sums.earnedDeductions += monthlyDeduction * share * paidFraction;
      }
      const projectedFraction = future || unmarkedDates.at(-1) === d.date ? 1 : paidFraction;
      sums.projectedGross += base * share * projectedFraction;
      sums.projectedDeductions += monthlyDeduction * share * projectedFraction;
    }
    const salaryNow = calc.effective(history, today) || current;
    const monthly = salaryNow
      ? (salaryNow.components || []).filter((x) => x.type === "earning").reduce((v, x) => v + Number(x.amount), 0) || Number(salaryNow.monthlyCost)
      : null;
    const net = (g, d) => calc.round(Math.max(0, g - d));
    rows.push({
      employeeId: e.id,
      fullName: e.fullName,
      employeeNumber: e.employeeNumber,
      status: e.status,
      joiningDate: e.joiningDate,
      monthlySalary: monthly,
      missingSalary: !salaryNow,
      ...counts,
      unmarkedDates,
      earned: { gross: calc.round(sums.earnedGross), deductions: calc.round(sums.earnedDeductions), net: net(sums.earnedGross, sums.earnedDeductions) },
      projected: { gross: calc.round(sums.projectedGross), deductions: calc.round(sums.projectedDeductions), net: net(sums.projectedGross, sums.projectedDeductions) },
    });
  }
  const total = (key, field) => calc.round(rows.reduce((s, r) => s + r[key][field], 0));
  return {
    month: start.slice(0, 7),
    startDate: start,
    endDate: end,
    today,
    currency: p.currency,
    generatedAt: new Date().toISOString(),
    rows,
    totals: {
      employees: rows.length,
      earnedNet: total("earned", "net"),
      projectedNet: total("projected", "net"),
      unmarked: rows.reduce((s, r) => s + r.unmarked, 0),
      missingSalary: rows.filter((r) => r.missingSalary).length,
    },
  };
}

module.exports = { salary, monthBounds, draft, action, payslip, live };
