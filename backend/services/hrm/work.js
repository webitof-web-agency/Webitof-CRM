const c = require("./core");
const calc = require("./calculations");
async function tasks(user, employeeId, projectId, db = c.dbDefault) {
  const e = await c.employee(db, user, employeeId);
  const values = [e.userId];
  let filter = "";
  if (projectId) {
    values.push(projectId);
    filter = " AND p.id=$2";
  }
  const rows = await db.query(
    `SELECT p.id,p.title,p.client_id,p.payload->'activities' AS activities FROM projects p WHERE (p.payload->>'assignedTo'=$1 OR EXISTS(SELECT 1 FROM hrm_allocations a JOIN hrm_employees e ON e.id=a.employee_id WHERE a.project_id=p.id AND e.user_id=$1 AND a.archived_at IS NULL) OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.payload->'activities')='array' THEN p.payload->'activities' ELSE '[]' END) a WHERE a->>'type'='task' AND a->>'assignedTo'=$1))${filter} LIMIT 100`,
    values,
  );
  const result = [];
  for (const p of rows.rows)
    for (const a of Array.isArray(p.activities) ? p.activities : [])
      if (
        a.type === "task" &&
        (a.assignedTo === e.userId ||
          (a.collaborators || []).includes(e.userId))
      )
        result.push({
          id: a.id,
          source: "activity",
          title: a.title,
          status: a.status,
          priority: a.priority,
          deadline: a.deadline,
          startDate: a.startDate,
          estimatedHours: a.estimatedHours || null,
          projectId: p.id,
          projectTitle: p.title,
          clientId: p.client_id,
        });
  const eventValues = [e.userId];
  if (projectId) eventValues.push(projectId);
  const events = await db.query(
    `SELECT id,title,project_id,client_id,end_date,payload FROM lead_events WHERE event_type='task' AND (owner_user_id=$1 OR payload->>'assignedTo'=$1)${projectId ? " AND project_id=$2" : ""} ORDER BY created_at DESC LIMIT 500`,
    eventValues,
  );
  return [
    ...result,
    ...events.rows.map((t) => ({
      id: t.id,
      source: "event",
      title: t.title,
      projectId: t.project_id,
      clientId: t.client_id,
      deadline: t.end_date,
      status: t.payload.status || "To do",
      estimatedHours: t.payload.estimatedHours || null,
    })),
  ];
}
async function saveReport(user, body, id = null, db = null) {
  c.permit(user, "self_service");
  c.allow(body, ["employeeId", "workDate", "summary", "entries", "version"]);
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, body.employeeId, {
      lock: true,
      own: true,
    });
    const p = await c.policy(tx);
    const workDate = c.date(body.workDate);
    const now = c.today(p);
    if (
      workDate > now ||
      workDate < e.joiningDate ||
      (e.exitDate && workDate > e.exitDate)
    )
      c.fail("Work date is outside active employment or in the future");
    if (
      workDate < now &&
      (!p.allowBackdatedReports ||
        (Date.parse(now) - Date.parse(workDate)) / 86400000 > p.maxBackdateDays)
    )
      c.fail("Backdated reports are outside the configured policy");
    const old = id
      ? c.camel(
          (
            await tx.query(
              "SELECT * FROM hrm_work_reports WHERE id=$1 AND employee_id=$2 FOR UPDATE",
              [id, e.id],
            )
          ).rows[0],
        )
      : null;
    if (id && !old) c.fail("Report not found", 404);
    if (old) {
      c.optimistic(old, body);
      if (!["Draft", "Revision Requested"].includes(old.status))
        c.fail("Only drafts and revision requests can be edited", 409);
      if (old.workDate !== workDate)
        c.fail("The report date cannot be changed");
    }
    if (!Array.isArray(body.entries) || body.entries.length > 100)
      c.fail("Provide up to 100 work entries");
    const entries = [];
    let total = 0;
    for (const entry of body.entries) {
      c.allow(entry, [
        "projectId",
        "clientId",
        "taskId",
        "taskSource",
        "categoryId",
        "description",
        "completed",
        "inProgress",
        "blocker",
        "startedAt",
        "endedAt",
        "minutes",
        "billable",
        "completion",
        "priority",
        "evidenceUrl",
        "reference",
        "remarks",
      ]);
      const v = {};
      for (const key of [
        "description",
        "completed",
        "inProgress",
        "blocker",
        "reference",
        "remarks",
      ])
        v[key] =
          c.text(
            entry[key],
            key,
            4000,
            key === "description" && p.requireDescription,
          ) || "";
      v.projectId = entry.projectId || null;
      v.clientId = entry.clientId || null;
      v.taskId = entry.taskId || null;
      v.taskSource = entry.taskSource || null;
      v.categoryId = entry.categoryId || null;
      if (p.requireProject && !v.projectId) c.fail("A project is required");
      if (p.requireTask && !v.taskId) c.fail("A task is required");
      if (v.projectId) {
        const project = (
          await tx.query(
            "SELECT id,client_id,payload FROM projects WHERE id=$1",
            [v.projectId],
          )
        ).rows[0];
        if (!project) c.fail("Project does not exist");
        const allocated = await tx.query(
          "SELECT id FROM hrm_allocations WHERE employee_id=$1 AND project_id=$2 AND start_date<=$3 AND end_date>=$3 AND archived_at IS NULL",
          [e.id, v.projectId, workDate],
        );
        const assignedTask = (project.payload.activities || []).some(
          (a) =>
            a.type === "task" &&
            (a.assignedTo === e.userId ||
              (a.collaborators || []).includes(e.userId)),
        );
        if (
          !allocated.rowCount &&
          project.payload.assignedTo !== e.userId &&
          !assignedTask
        )
          c.fail("Work can only be logged against assigned projects", 403);
        if (v.clientId && v.clientId !== project.client_id)
          c.fail("Client does not match the project");
        v.clientId = project.client_id;
      } else if (v.clientId) c.fail("Client work must be linked to a project");
      if (v.taskId) {
        const choices = await tasks(user, e.id, v.projectId, tx);
        if (
          !choices.some(
            (t) =>
              t.id === v.taskId &&
              t.source === v.taskSource &&
              t.projectId === v.projectId,
          )
        )
          c.fail("Task must be assigned to this employee and project");
      }
      await c.master(tx, v.categoryId, "work_category");
      v.minutes = c.number(entry.minutes, "Duration in minutes", 1, 1440);
      if (!Number.isInteger(v.minutes))
        c.fail("Duration must be whole minutes");
      v.startedAt = c.instant(entry.startedAt, "Start time", true);
      v.endedAt = c.instant(entry.endedAt, "End time", true);
      if (Boolean(v.startedAt) !== Boolean(v.endedAt))
        c.fail("Provide both start and end time");
      if (v.startedAt) {
        if (c.today(p, new Date(v.startedAt)) !== workDate)
          c.fail("Entry must start on the work-report date");
        if (
          Math.round(
            (Date.parse(v.endedAt) - Date.parse(v.startedAt)) / 60000,
          ) !== v.minutes
        )
          c.fail("Duration must equal the start/end interval");
        if (
          entries.some(
            (x) =>
              x.startedAt && v.startedAt < x.endedAt && v.endedAt > x.startedAt,
          )
        )
          c.fail("Work intervals overlap");
      }
      v.billable = c.boolean(entry.billable ?? false, "Billable");
      v.completion = c.number(entry.completion ?? 0, "Completion", 0, 100);
      v.priority = c.choice(
        entry.priority || "Medium",
        ["Low", "Medium", "High", "Urgent"],
        "Priority",
      );
      v.evidenceUrl = c.text(entry.evidenceUrl, "Evidence link", 2000);
      if (v.evidenceUrl && !/^https:\/\//i.test(v.evidenceUrl))
        c.fail("Evidence must be an HTTPS link");
      if (p.requireEvidence && !v.evidenceUrl) c.fail("Evidence is required");
      total += v.minutes;
      entries.push(v);
    }
    if (total > p.maxReportHours * 60)
      c.fail("Report hours exceed the configured maximum");
    const report = old
      ? await c.update(tx, "hrm_work_reports", id, {
          summary: c.text(body.summary, "Summary", 4000) || "",
          status: "Draft",
          version: old.version + 1,
          updatedAt: new Date(),
        })
      : await c.insert(tx, "hrm_work_reports", {
          employeeId: e.id,
          workDate,
          summary: c.text(body.summary, "Summary", 4000) || "",
        });
    if (old)
      await tx.query("DELETE FROM hrm_work_entries WHERE report_id=$1", [id]);
    for (const entry of entries)
      await c.insert(tx, "hrm_work_entries", { ...entry, reportId: report.id });
    await c.audit(
      tx,
      user,
      "work-reports",
      report.id,
      old ? "edited" : "created",
      old,
      report,
      e.id,
    );
    return report;
  }, db);
}
async function reportAction(user, id, body, db = null) {
  c.allow(body, ["action", "comment"]);
  return c.transaction(async (tx) => {
    const r = c.camel(
      (
        await tx.query(
          "SELECT * FROM hrm_work_reports WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0],
    );
    if (!r) c.fail("Report not found", 404);
    const e = await c.employee(tx, user, r.employeeId);
    const action = c.choice(
      body.action,
      ["submit", "review", "approve", "revise"],
      "Action",
    );
    let status;
    const patch = {};
    if (action === "submit") {
      c.permit(user, "self_service");
      if (e.userId !== user.id) c.fail("Submit your own report", 403);
      if (!["Draft", "Revision Requested"].includes(r.status))
        c.fail("Report is already submitted", 409);
      const totals = await tx.query(
        "SELECT count(*)::int AS count,sum(minutes)::int AS minutes FROM hrm_work_entries WHERE report_id=$1",
        [id],
      );
      if (!totals.rows[0].count) c.fail("Add work entries before submitting");
      const p = await c.policy(tx);
      status = p.requireReportApproval ? "Submitted" : "Approved";
      patch.submittedAt = new Date();
    } else {
      c.permit(user, "approve");
      if (e.userId === user.id)
        c.fail("You cannot review your own work report", 403);
      if (!["Submitted", "Reviewed"].includes(r.status))
        c.fail("Report is not awaiting review", 409);
      status = {
        review: "Reviewed",
        approve: "Approved",
        revise: "Revision Requested",
      }[action];
      patch.reviewedBy = user.id;
      patch.reviewedAt = new Date();
      patch.comment = c.text(
        body.comment,
        "Review comment",
        4000,
        action === "revise",
      );
    }
    const saved = await c.update(tx, "hrm_work_reports", id, {
      ...patch,
      status,
      version: r.version + 1,
      updatedAt: new Date(),
    });
    await c.audit(tx, user, "work-reports", id, action, r, saved, e.id);
    const recipient =
      action === "submit"
        ? (
            await tx.query("SELECT user_id FROM hrm_employees WHERE id=$1", [
              e.managerId,
            ])
          ).rows[0]?.user_id
        : e.userId;
    await c.notify(
      tx,
      recipient,
      `Work report ${status.toLowerCase()}`,
      id,
      user.id,
    );
    return saved;
  }, db);
}
async function reportDetail(user, id, db = c.dbDefault) {
  const r = c.camel(
    (await db.query("SELECT * FROM hrm_work_reports WHERE id=$1", [id]))
      .rows[0],
  );
  if (!r) c.fail("Report not found", 404);
  await c.employee(db, user, r.employeeId);
  return {
    ...r,
    entries: (
      await db.query(
        "SELECT w.*,p.title AS project_title FROM hrm_work_entries w LEFT JOIN projects p ON p.id=w.project_id WHERE report_id=$1 ORDER BY w.created_at,w.id",
        [id],
      )
    ).rows.map(c.camel),
  };
}
async function timesheet(user, body, id = null, db = null) {
  return c.transaction(async (tx) => {
    if (id) {
      c.permit(user, "approve");
      const r = c.camel(
        (
          await tx.query(
            "SELECT * FROM hrm_timesheets WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0],
      );
      if (!r) c.fail("Timesheet not found", 404);
      const e = await c.employee(tx, user, r.employeeId);
      if (e.userId === user.id)
        c.fail("You cannot approve your own timesheet", 403);
      if (r.status !== "Submitted")
        c.fail("Timesheet is not awaiting approval", 409);
      const status = c.choice(body.status, ["Approved", "Revision Requested"]);
      const saved = await c.update(tx, "hrm_timesheets", id, {
        status,
        comment: c.text(
          body.comment,
          "Comment",
          4000,
          status === "Revision Requested",
        ),
        reviewedBy: user.id,
        updatedAt: new Date(),
      });
      await c.audit(tx, user, "timesheets", id, "reviewed", r, saved, e.id);
      return saved;
    }
    c.permit(user, "self_service");
    c.allow(body, ["employeeId", "startDate", "endDate"]);
    const e = await c.employee(tx, user, body.employeeId, {
      lock: true,
      own: true,
    });
    const { start, end } = c.range(body, await c.policy(tx));
    if (end > c.today(await c.policy(tx)))
      c.fail("A future timesheet cannot be submitted");
    const overlaps = await tx.query(
      "SELECT id FROM hrm_timesheets WHERE employee_id=$1 AND start_date<=$3 AND end_date>=$2 AND status<>'Revision Requested'",
      [e.id, start, end],
    );
    if (overlaps.rowCount)
      c.fail("A timesheet already covers these dates", 409);
    const reports = await tx.query(
      "SELECT id,status FROM hrm_work_reports WHERE employee_id=$1 AND work_date BETWEEN $2 AND $3 ORDER BY work_date FOR UPDATE",
      [e.id, start, end],
    );
    if (!reports.rowCount || reports.rows.some((r) => r.status !== "Approved"))
      c.fail("All included work reports must be approved");
    const existing = (
      await tx.query(
        "SELECT id FROM hrm_timesheets WHERE employee_id=$1 AND start_date=$2 AND end_date=$3 AND status='Revision Requested'",
        [e.id, start, end],
      )
    ).rows[0];
    const values = {
      employeeId: e.id,
      startDate: start,
      endDate: end,
      status: "Submitted",
      reportIds: JSON.stringify(reports.rows.map((r) => r.id)),
    };
    const saved = existing
      ? await c.update(tx, "hrm_timesheets", existing.id, {
          ...values,
          updatedAt: new Date(),
        })
      : await c.insert(tx, "hrm_timesheets", values);
    await c.audit(
      tx,
      user,
      "timesheets",
      saved.id,
      "submitted",
      null,
      saved,
      e.id,
    );
    return saved;
  }, db);
}
async function allocation(user, body, id = null, db = null) {
  c.permit(user, "manage_allocations");
  c.allow(body, [
    "employeeId",
    "projectId",
    "role",
    "percent",
    "startDate",
    "endDate",
    "plannedHours",
    "billable",
    "billingRate",
  ]);
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, body.employeeId, { lock: true });
    const p = await c.policy(tx);
    const { start, end } = c.range(body, p);
    if (start < e.joiningDate || (e.exitDate && end > e.exitDate))
      c.fail("Allocation is outside employment dates");
    const project = (
      await tx.query("SELECT id,payload FROM projects WHERE id=$1", [
        body.projectId,
      ])
    ).rows[0];
    if (!project) c.fail("Project does not exist");
    if (!c.can(user, "view_all") && project.payload.assignedTo !== user.id)
      c.fail("Only managed projects can be allocated", 403);
    const percent = c.number(body.percent, "Allocation percent", 0.01, 100);
    const overlaps = await tx.query(
      "SELECT id,percent,start_date,end_date FROM hrm_allocations WHERE employee_id=$1 AND start_date<=$3 AND end_date>=$2 AND archived_at IS NULL AND id<>$4",
      [e.id, start, end, id || ""],
    );
    if (
      !p.allowOverAllocation &&
      c
        .days(start, end)
        .some(
          (d) =>
            percent +
              overlaps.rows
                .filter((a) => a.start_date <= d && a.end_date >= d)
                .reduce((s, a) => s + Number(a.percent), 0) >
            100,
        )
    )
      c.fail("Allocation exceeds available percentage on one or more days");
    const values = {
      employeeId: e.id,
      projectId: project.id,
      role: c.text(body.role, "Project role", 120, true),
      percent,
      startDate: start,
      endDate: end,
      plannedHours:
        body.plannedHours == null || body.plannedHours === ""
          ? null
          : c.number(body.plannedHours, "Planned hours"),
      billable: c.boolean(body.billable ?? false),
    };
    if (body.billingRate != null && body.billingRate !== "") {
      c.permit(user, "view_salary");
      values.billingRate = c.number(body.billingRate, "Billing rate");
    }
    const old = id
      ? c.camel(
          (
            await tx.query(
              "SELECT * FROM hrm_allocations WHERE id=$1 AND employee_id=$2",
              [id, e.id],
            )
          ).rows[0],
        )
      : null;
    if (id && !old) c.fail("Allocation not found", 404);
    const saved = id
      ? await c.update(tx, "hrm_allocations", id, {
          ...values,
          updatedAt: new Date(),
        })
      : await c.insert(tx, "hrm_allocations", {
          ...values,
          createdBy: user.id,
        });
    await c.audit(
      tx,
      user,
      "allocations",
      saved.id,
      "saved",
      old,
      saved,
      e.id,
      true,
    );
    if (!c.can(user, "view_salary")) delete saved.billingRate;
    return saved;
  }, db);
}
module.exports = {
  tasks,
  saveReport,
  reportAction,
  reportDetail,
  timesheet,
  allocation,
};
