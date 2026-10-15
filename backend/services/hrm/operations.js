const c = require("./core");
const calc = require("./calculations");
async function calendarData(db, employeeId, start, end) {
  // `db` is normally a transaction client. A pg Client can only execute one
  // query at a time; starting these together is deprecated and breaks in pg 9.
  const h = await db.query(
    "SELECT * FROM hrm_holidays WHERE work_date BETWEEN $1 AND $2",
    [start, end],
  );
  const l = await db.query(
    "SELECT * FROM hrm_requests WHERE employee_id=$1 AND kind='leave' AND status='Approved' AND start_date<=$3 AND end_date>=$2",
    [employeeId, start, end],
  );
  const m = await db.query("SELECT * FROM master_items WHERE type='hrm_shift'");
  const x = await db.query(
    "SELECT * FROM hrm_employment_history WHERE employee_id=$1 AND effective_date<=$2 ORDER BY effective_date,created_at",
    [employeeId, end],
  );
  return {
    holidays: h.rows.map(c.camel),
    leave: l.rows.map(c.camel),
    masters: m.rows.map(c.camel),
    history: x.rows.map(c.camel),
  };
}
async function clock(user, body, db = null) {
  c.permit(user, "self_service");
  c.allow(body, ["employeeId", "action", "status"]);
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, body.employeeId, {
      lock: true,
      own: true,
    });
    const p = await c.policy(tx);
    const day = c.today(p);
    const action = c.choice(body.action, [
      "check-in",
      "check-out",
      "break-start",
      "break-end",
    ]);
    if (
      e.joiningDate > day ||
      (e.exitDate && e.exitDate < day) ||
      !["Active", "Probation", "Confirmed", "Notice Period"].includes(e.status)
    )
      c.fail("Attendance requires active employment");
    let r = c.camel(
      (
        await tx.query(
          "SELECT * FROM hrm_attendance WHERE employee_id=$1 AND check_in IS NOT NULL AND check_out IS NULL FOR UPDATE",
          [e.id],
        )
      ).rows[0],
    );
    const before = r;
    const now = new Date();
    if (action === "check-in") {
      if (r) c.fail("An attendance session is already open", 409);
      const locked = await tx.query(
        "SELECT p.id FROM hrm_payroll_runs p JOIN hrm_payroll_entries pe ON pe.run_id=p.id WHERE pe.employee_id=$1 AND p.start_date<=$2 AND p.end_date>=$2",
        [e.id, day],
      );
      if (locked.rowCount)
        c.fail("Attendance period is locked by payroll", 409);
      const data = await calendarData(tx, e.id, day, day);
      const available = calc.calendar(e, day, day, p, data)[0];
      if (available.kind === "Leave")
        c.fail("Full-day approved leave already covers today");
      const shift = await c.master(tx, e.shiftId || p.defaultShiftId, "shift");
      const existing = c.camel(
        (
          await tx.query(
            "SELECT * FROM hrm_attendance WHERE employee_id=$1 AND work_date=$2 FOR UPDATE",
            [e.id, day],
          )
        ).rows[0],
      );
      if (existing)
        c.fail(
          "Attendance already exists for today; request regularization",
          409,
        );
      r = await c.insert(tx, "hrm_attendance", {
        employeeId: e.id,
        workDate: day,
        checkIn: now,
        status: c.choice(body.status || "Present", [
          "Present",
          "WFH",
          "Business Visit",
        ]),
        shiftSnapshot: JSON.stringify(shift?.payload || {}),
      });
    } else {
      if (!r) c.fail("No open attendance session", 409);
      if (r.lockedAt) c.fail("Attendance is locked", 409);
      if (action === "break-start") {
        if (r.breakStartedAt) c.fail("A break is already active", 409);
        r = await c.update(tx, "hrm_attendance", r.id, {
          breakStartedAt: now,
          updatedAt: now,
        });
      } else {
        let minutes = Number(r.breakMinutes);
        if (r.breakStartedAt)
          minutes += Math.max(
            0,
            Math.floor((now - new Date(r.breakStartedAt)) / 60000),
          );
        if (action === "break-end") {
          if (!r.breakStartedAt) c.fail("No active break", 409);
          r = await c.update(tx, "hrm_attendance", r.id, {
            breakMinutes: minutes,
            breakStartedAt: null,
            updatedAt: now,
          });
        } else {
          const values = {
            ...r,
            checkOut: now.toISOString(),
            breakMinutes: minutes,
          };
          const metrics = calc.attendanceMetrics(values, r.shiftSnapshot, p);
          r = await c.update(tx, "hrm_attendance", r.id, {
            checkOut: now,
            breakMinutes: minutes,
            breakStartedAt: null,
            ...metrics,
            updatedAt: now,
          });
        }
      }
    }
    await c.audit(tx, user, "attendance", r.id, action, before, r, e.id);
    return r;
  }, db);
}
async function leaveBalance(user, employeeId, year, db = c.dbDefault) {
  await c.employee(db, user, employeeId);
  c.number(year, "Year", 2000, 2200);
  return (
    await db.query(
      `SELECT m.id AS leave_type_id,m.name,m.payload,coalesce(sum(l.amount),0)::numeric AS balance FROM master_items m LEFT JOIN hrm_leave_ledger l ON l.leave_type_id=m.id AND l.employee_id=$1 AND l.year=$2 WHERE m.type='hrm_leave_type' AND m.is_active=true GROUP BY m.id ORDER BY m.name`,
      [employeeId, year],
    )
  ).rows.map(c.camel);
}
async function grantLeave(user, body, db = null) {
  c.permit(user, "hr_approve");
  c.allow(body, [
    "employeeId",
    "leaveTypeId",
    "year",
    "amount",
    "reason",
    "sourceKey",
  ]);
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, body.employeeId, { lock: true });
    await c.master(tx, body.leaveTypeId, "leave_type", true);
    const r = await c.insert(tx, "hrm_leave_ledger", {
      employeeId: e.id,
      leaveTypeId: body.leaveTypeId,
      year: c.number(body.year, "Year", 2000, 2200),
      amount: c.number(body.amount, "Days", -366, 366),
      reason: c.text(body.reason, "Reason", 1000, true),
      sourceKey: c.text(body.sourceKey, "Unique grant reference", 200, true),
      createdBy: user.id,
    });
    await c.audit(tx, user, "leave-ledger", r.id, "granted", null, r, e.id);
    return r;
  }, db);
}
async function request(user, body, id = null, db = null) {
  c.permit(user, "self_service");
  c.allow(body, [
    "employeeId",
    "kind",
    "title",
    "startDate",
    "endDate",
    "details",
    "version",
  ]);
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, body.employeeId, {
      lock: true,
      own: true,
    });
    const kind = c.choice(body.kind, [
      "leave",
      "regularization",
      "reimbursement",
      "resignation",
      "helpdesk",
    ]);
    const old = id
      ? c.camel(
          (
            await tx.query(
              "SELECT * FROM hrm_requests WHERE id=$1 AND employee_id=$2 FOR UPDATE",
              [id, e.id],
            )
          ).rows[0],
        )
      : null;
    if (id && !old) c.fail("Request not found", 404);
    if (old) {
      c.optimistic(old, body);
      if (!["Draft", "Revision Requested"].includes(old.status))
        c.fail("Submitted requests cannot be edited", 409);
      if (old.kind !== kind) c.fail("Request kind cannot change");
    }
    const start = c.date(body.startDate, "Start date");
    const end = c.date(body.endDate || start, "End date");
    if (end < start) c.fail("End date precedes start date");
    c.days(start, end);
    const d = body.details || {};
    const p = await c.policy(tx);
    if (kind === "leave") {
      c.allow(d, ["leaveTypeId", "fraction", "reason", "documentId"]);
      const m = await c.master(tx, d.leaveTypeId, "leave_type", true);
      d.fraction = c.number(d.fraction ?? 1, "Day fraction", 0.5, 1);
      if (
        ![0.5, 1].includes(d.fraction) ||
        (d.fraction === 0.5 && start !== end)
      )
        c.fail("Half-day leave must be for one date");
      if (d.fraction === 0.5 && m.payload.halfDayAllowed === false)
        c.fail("This leave type does not allow half days");
      if (
        e.status === "Probation" &&
        (m.payload.probationAllowed === false || !p.probationLeaveAllowed)
      )
        c.fail("Leave is unavailable during probation");
      if (
        m.payload.employmentTypeIds?.length &&
        !m.payload.employmentTypeIds.includes(e.employmentTypeId)
      )
        c.fail("Leave type does not apply to this employment type");
      if (start < e.joiningDate || (e.exitDate && end > e.exitDate))
        c.fail("Leave is outside employment dates");
      if (start.slice(0, 4) !== end.slice(0, 4))
        c.fail("Submit separate requests for each calendar year");
      const conflict = await tx.query(
        "SELECT id FROM hrm_requests WHERE employee_id=$1 AND kind='leave' AND status IN ('Submitted','Manager Approved','Approved') AND start_date<=$3 AND end_date>=$2 AND id<>$4",
        [e.id, start, end, id || ""],
      );
      if (conflict.rowCount)
        c.fail("Leave overlaps another active request", 409);
      const calendar = calc.calendar(
        e,
        start,
        end,
        p,
        await calendarData(tx, e.id, start, end),
      );
      d.days = calc.round(
        (m.payload.sandwich
          ? calendar.length
          : calendar.filter((x) => x.hours > 0).length) * d.fraction,
      );
      if (d.days <= 0) c.fail("No working days in the requested period");
      d.paid = m.payload.paid !== false;
      d.policySnapshot = m.payload;
    } else if (kind === "regularization") {
      c.allow(d, ["checkIn", "checkOut", "breakMinutes", "reason", "status"]);
      if (start !== end || start > c.today(p))
        c.fail("Regularization must be for one past or current date");
      d.checkIn = c.instant(d.checkIn, "Check in");
      d.checkOut = c.instant(d.checkOut, "Check out");
      if (c.today(p, new Date(d.checkIn)) !== start)
        c.fail("Check in does not match attendance date");
      d.breakMinutes = c.number(d.breakMinutes ?? 0, "Break minutes", 0, 1440);
      d.status = c.choice(d.status || "Present", [
        "Present",
        "WFH",
        "Half Day",
        "Business Visit",
      ]);
      if (
        Date.parse(d.checkOut) > Date.now() ||
        Date.parse(d.checkOut) - Date.parse(d.checkIn) > 86400000 ||
        Date.parse(d.checkOut) <= Date.parse(d.checkIn)
      )
        c.fail("Attendance interval must be completed and at most 24 hours");
    } else if (kind === "reimbursement") {
      c.allow(d, [
        "amount",
        "categoryId",
        "projectId",
        "clientId",
        "documentId",
        "reason",
      ]);
      d.amount = c.number(d.amount, "Amount", 0.01, 1e8);
      const m = await tx.query(
        "SELECT id FROM master_items WHERE id=$1 AND type='expense_category' AND is_active=true",
        [d.categoryId],
      );
      if (!m.rowCount) c.fail("Expense category is required");
      if (d.projectId) {
        const project = await tx.query(
          "SELECT id,client_id FROM projects WHERE id=$1",
          [d.projectId],
        );
        if (!project.rowCount) c.fail("Invalid project");
        const allowed = await tx.query(
          "SELECT id FROM hrm_allocations WHERE employee_id=$1 AND project_id=$2 AND archived_at IS NULL",
          [e.id, d.projectId],
        );
        if (!allowed.rowCount) c.fail("Project is not assigned to you", 403);
        d.clientId = project.rows[0].client_id;
      } else if (d.clientId) c.fail("Link a project for client expenses");
      if (!d.documentId) c.fail("Attach a private receipt document first");
    } else if (kind === "resignation") {
      c.allow(d, ["reason", "lastWorkingDate"]);
      d.lastWorkingDate = c.date(d.lastWorkingDate || end);
      if (d.lastWorkingDate < start)
        c.fail("Last working date precedes resignation");
    } else c.allow(d, ["reason", "category"]);
    d.reason = c.text(d.reason, "Reason", 4000, true);
    if (d.documentId) {
      const document = await tx.query(
        "SELECT id FROM hrm_documents WHERE id=$1 AND employee_id=$2",
        [d.documentId, e.id],
      );
      if (!document.rowCount)
        c.fail("Attachment does not belong to this employee");
    }
    const values = {
      employeeId: e.id,
      kind,
      title: c.text(body.title, "Title", 200, true),
      startDate: start,
      endDate: end,
      details: JSON.stringify(d),
      status: "Submitted",
    };
    const saved = old
      ? await c.update(tx, "hrm_requests", id, {
          ...values,
          version: old.version + 1,
          updatedAt: new Date(),
        })
      : await c.insert(tx, "hrm_requests", { ...values, createdBy: user.id });
    await c.audit(
      tx,
      user,
      "requests",
      saved.id,
      "submitted",
      old,
      saved,
      e.id,
    );
    const manager = (
      await tx.query("SELECT user_id FROM hrm_employees WHERE id=$1", [
        e.managerId,
      ])
    ).rows[0];
    await c.notify(
      tx,
      manager?.user_id,
      `${kind} request submitted`,
      saved.id,
      user.id,
    );
    return saved;
  }, db);
}
async function approveRequest(user, id, body, db = null) {
  c.allow(body, ["action", "comment"]);
  return c.transaction(async (tx) => {
    const r = c.camel(
      (
        await tx.query("SELECT * FROM hrm_requests WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0],
    );
    if (!r) c.fail("Request not found", 404);
    const e = await c.employee(tx, user, r.employeeId, { lock: true });
    const action = c.choice(
      body.action,
      ["approve", "reject", "revise", "cancel"],
      "Action",
    );
    if (action === "cancel") {
      c.permit(user, "self_service");
      if (e.userId !== user.id) c.fail("Cancel your own request", 403);
      if (!["Submitted", "Manager Approved"].includes(r.status))
        c.fail("Only pending requests can be cancelled", 409);
    } else {
      if (e.userId === user.id)
        c.fail("You cannot approve your own request", 403);
      c.permit(
        user,
        r.status === "Manager Approved"
          ? r.kind === "reimbursement"
            ? "finance"
            : "hr_approve"
          : "approve",
      );
      if (!["Submitted", "Manager Approved"].includes(r.status))
        c.fail("Request is not awaiting approval", 409);
    }
    const p = await c.policy(tx);
    const needsFinal =
      r.kind === "reimbursement" ||
      r.kind === "resignation" ||
      (r.kind === "leave" && p.requireHrLeaveApproval) ||
      (r.kind === "regularization" && p.requireHrRegularizationApproval);
    let status =
      action === "approve"
        ? needsFinal && r.status === "Submitted"
          ? "Manager Approved"
          : "Approved"
        : {
            reject: "Rejected",
            revise: "Revision Requested",
            cancel: "Cancelled",
          }[action];
    const comment = c.text(
      body.comment,
      "Review comment",
      4000,
      ["reject", "revise"].includes(action),
    );
    if (status === "Approved") {
      const locked = await tx.query(
        "SELECT pe.id FROM hrm_payroll_entries pe JOIN hrm_payroll_runs p ON p.id=pe.run_id WHERE pe.employee_id=$1 AND p.start_date<=$3 AND p.end_date>=$2",
        [e.id, r.startDate, r.endDate],
      );
      if (["leave", "regularization"].includes(r.kind) && locked.rowCount)
        c.fail("This period is locked by payroll", 409);
      if (r.kind === "leave") {
        const overlaps = await tx.query(
          "SELECT id FROM hrm_requests WHERE employee_id=$1 AND kind='leave' AND status='Approved' AND start_date<=$3 AND end_date>=$2",
          [e.id, r.startDate, r.endDate],
        );
        if (overlaps.rowCount) c.fail("Leave overlaps approved leave", 409);
        const attendance = await tx.query(
          "SELECT id FROM hrm_attendance WHERE employee_id=$1 AND work_date BETWEEN $2 AND $3 AND (check_in IS NOT NULL OR locked_at IS NOT NULL)",
          [e.id, r.startDate, r.endDate],
        );
        if (attendance.rowCount)
          c.fail(
            "Existing attendance must be resolved before leave approval",
            409,
          );
        if (r.details.paid) {
          const balance = await tx.query(
            "SELECT coalesce(sum(amount),0)::numeric AS total FROM hrm_leave_ledger WHERE employee_id=$1 AND leave_type_id=$2 AND year=$3",
            [e.id, r.details.leaveTypeId, Number(r.startDate.slice(0, 4))],
          );
          if (Number(balance.rows[0].total) < r.details.days)
            c.fail("Insufficient allocated leave balance");
          await c.insert(tx, "hrm_leave_ledger", {
            employeeId: e.id,
            leaveTypeId: r.details.leaveTypeId,
            year: Number(r.startDate.slice(0, 4)),
            amount: -r.details.days,
            reason: "Approved leave",
            sourceKey: `leave:${r.id}`,
            createdBy: user.id,
          });
        }
        const cal = calc.calendar(
          e,
          r.startDate,
          r.endDate,
          p,
          await calendarData(tx, e.id, r.startDate, r.endDate),
        );
        for (const d of cal.filter((d) => d.hours > 0)) {
          await tx.query(
            `INSERT INTO hrm_attendance(id,employee_id,work_date,status) VALUES($1,$2,$3,$4) ON CONFLICT(employee_id,work_date) DO UPDATE SET status=excluded.status,updated_at=now()`,
            [
              require("../../utils/format").createId("att"),
              e.id,
              d.date,
              r.details.fraction === 0.5 ? "Half Day" : "Leave",
            ],
          );
        }
      }
      if (r.kind === "regularization") {
        const old = c.camel(
          (
            await tx.query(
              "SELECT * FROM hrm_attendance WHERE employee_id=$1 AND work_date=$2 FOR UPDATE",
              [e.id, r.startDate],
            )
          ).rows[0],
        );
        if (old?.lockedAt || old?.breakStartedAt)
          c.fail("Attendance is locked or has an active break", 409);
        const leave = await tx.query(
          "SELECT id FROM hrm_requests WHERE employee_id=$1 AND kind='leave' AND status='Approved' AND start_date<=$2 AND end_date>=$2",
          [e.id, r.startDate],
        );
        if (leave.rowCount) c.fail("Approved leave covers this date");
        const shift =
          (await c.master(tx, e.shiftId || p.defaultShiftId, "shift"))
            ?.payload || {};
        const values = {
          employeeId: e.id,
          workDate: r.startDate,
          checkIn: r.details.checkIn,
          checkOut: r.details.checkOut,
          breakMinutes: r.details.breakMinutes,
          status: r.details.status,
          source: "regularization",
          shiftSnapshot: JSON.stringify(shift),
        };
        Object.assign(values, calc.attendanceMetrics(values, shift, p));
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
          "regularized",
          old,
          saved,
          e.id,
        );
      }
      if (r.kind === "reimbursement") {
        const expense = await c.insert(tx, "expenses", {
          expenseDate: r.startDate,
          vendor: e.fullName,
          payeeName: e.fullName,
          payeeType: "Employee",
          employeeId: e.userId,
          payeeId: e.userId || e.id,
          expenseType: "Reimbursement",
          categoryId: r.details.categoryId,
          projectId: r.details.projectId || null,
          clientId: r.details.clientId || null,
          amountBeforeGst: r.details.amount,
          totalAmount: r.details.amount,
          balanceDue: r.details.amount,
          status: "Approved",
          approvalStatus: "Approved",
          paymentStatus: "Unpaid",
          notes: r.details.reason,
          payload: JSON.stringify({ hrmRequestId: r.id, hrmEmployeeId: e.id }),
        });
        r.details.expenseId = expense.id;
      }
      if (r.kind === "resignation") {
        await c.update(tx, "hrm_employees", e.id, {
          status: "Notice Period",
          exitDate: r.details.lastWorkingDate,
          updatedAt: new Date(),
          version: e.version + 1,
        });
        await c.insert(tx, "hrm_employment_history", {
          employeeId: e.id,
          effectiveDate: c.today(p),
          snapshot: JSON.stringify({
            ...e,
            profile: undefined,
            status: "Notice Period",
            exitDate: r.details.lastWorkingDate,
          }),
          reason: "Resignation approved",
          createdBy: user.id,
        });
        for (const title of p.offboardingChecklist)
          await c.insert(tx, "hrm_records", {
            kind: "offboarding",
            employeeId: e.id,
            title,
            status: "Pending",
            endDate: r.details.lastWorkingDate,
            createdBy: user.id,
          });
      }
    }
    const saved = await c.update(tx, "hrm_requests", id, {
      status,
      details: JSON.stringify(r.details),
      reviewedBy: user.id,
      reviewedAt: new Date(),
      comment,
      version: r.version + 1,
      updatedAt: new Date(),
    });
    await c.audit(tx, user, "requests", id, action, r, saved, e.id);
    await c.notify(
      tx,
      e.userId,
      `${r.kind} request ${status.toLowerCase()}`,
      id,
      user.id,
    );
    return saved;
  }, db);
}
module.exports = {
  calendarData,
  clock,
  leaveBalance,
  grantLeave,
  request,
  approveRequest,
};
