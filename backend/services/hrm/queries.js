const c = require("./core");
const { RECORDS } = require("../../config/hrmRecords");
const { MASTER_TYPES } = require("../../config/hrm");
const collections = {
  attendance: "hrm_attendance",
  "work-reports": "hrm_work_reports",
  timesheets: "hrm_timesheets",
  allocations: "hrm_allocations",
  requests: "hrm_requests",
  "salary-history": "hrm_salary_history",
  history: "hrm_employment_history",
  audit: "hrm_audit",
  documents: "hrm_documents",
};
async function list(user, kind, q = {}, db = c.dbDefault) {
  const config = RECORDS[kind];
  let table = collections[kind] || (config ? "hrm_records" : null);
  if (!table) c.fail("Unknown HR resource", 404);
  if (kind === "salary-history") c.permit(user, "view_salary");
  if (kind === "audit") c.permit(user, "audit");
  if (config?.global && kind !== "asset") c.permit(user, config.permission);
  if (config?.sensitive) {
    c.permit(user, config.permission);
    c.permit(user, "view_salary");
  }
  const values = [];
  const s = c.scope(user, values);
  const clauses = [
    config?.global && c.can(user, config.permission)
      ? `(r.employee_id IS NULL OR ${s})`
      : s,
  ];
  if (config) {
    values.push(kind);
    clauses.push(`r.kind=$${values.length}`, "r.archived_at IS NULL");
  }
  if (kind === "allocations") clauses.push("r.archived_at IS NULL");
  if (q.employeeId) {
    values.push(q.employeeId);
    clauses.push(`r.employee_id=$${values.length}`);
  }
  if (q.status) {
    values.push(q.status);
    clauses.push(`r.status=$${values.length}`);
  }
  if (q.kind && kind === "requests") {
    values.push(q.kind);
    clauses.push(`r.kind=$${values.length}`);
  }
  if (q.projectId && ["allocations", "work-reports"].includes(kind)) {
    values.push(q.projectId);
    clauses.push(
      kind === "allocations"
        ? `r.project_id=$${values.length}`
        : `EXISTS(SELECT 1 FROM hrm_work_entries w WHERE w.report_id=r.id AND w.project_id=$${values.length})`,
    );
  }
  if (q.search) {
    values.push(`%${c.text(q.search, "Search", 160)}%`);
    clauses.push(
      `(e.full_name ILIKE $${values.length}${config || kind === "requests" || kind === "documents" ? ` OR r.title ILIKE $${values.length}` : ""})`,
    );
  }
  if (q.startDate || q.endDate) {
    const { start, end } = c.range(q, await c.policy(db));
    values.push(start, end);
    const field = ["attendance", "work-reports"].includes(kind)
      ? "work_date"
      : kind === "salary-history" || kind === "history"
        ? "effective_date"
        : kind === "documents"
          ? "expires_on"
          : kind === "audit"
            ? "created_at::date"
            : "start_date";
    if (["allocations", "timesheets", "requests"].includes(kind) || config)
      clauses.push(
        `(r.start_date<=$${values.length} AND coalesce(r.end_date,r.start_date)>=$${values.length - 1})`,
      );
    else
      clauses.push(
        `r.${field} BETWEEN $${values.length - 1} AND $${values.length}`,
      );
  }
  // Push the parameter only with its clause: an unused bind value makes Postgres reject the query.
  if (kind === "documents" && !c.can(user, "view_private")) {
    values.push(user.id);
    clauses.push(`e.user_id=$${values.length}`);
  }
  if (
    kind === "audit" &&
    (!c.can(user, "view_private") || !c.can(user, "view_salary"))
  )
    clauses.push("r.sensitive=false");
  if (kind === "review" && !c.can(user, "performance"))
    clauses.push("r.status='Published'");
  const { page, limit } = c.page(q);
  const where = clauses.join(" AND ");
  const from = `FROM ${table} r LEFT JOIN hrm_employees e ON e.id=r.employee_id`;
  const total = (
    await db.query(
      `SELECT count(*)::int AS total ${from} WHERE ${where}`,
      values,
    )
  ).rows[0].total;
  values.push(limit, (page - 1) * limit);
  const columns =
    kind === "documents"
      ? "r.id,r.employee_id,r.title,r.category,r.file_name,r.mime_type,r.size_bytes,r.expires_on,r.status,r.review_comment,r.created_at"
      : kind === "allocations" && !c.can(user, "view_salary")
        ? "r.id,r.employee_id,r.project_id,r.role,r.percent,r.start_date,r.end_date,r.planned_hours,r.billable,r.created_at"
        : "r.*";
  const rows = (
    await db.query(
      `SELECT ${columns},e.full_name AS employee_name ${kind === "work-reports" ? ",(SELECT coalesce(sum(minutes),0)::int FROM hrm_work_entries w WHERE w.report_id=r.id) AS minutes" : ""} ${from} WHERE ${where} ORDER BY ${kind === "attendance" ? "r.work_date DESC" : "r.created_at DESC"},r.id LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    )
  ).rows.map(c.camel);
  return { rows, total, page, limit };
}
async function lookups(user, q = {}, db = c.dbDefault) {
  const type = q.type || "employees";
  const search = c.text(q.search, "Search", 160) || "";
  if (type === "employees")
    return require("./employees").list(user, { ...q, search, limit: 50 }, db);
  if (type === "users") {
    c.permit(user, "manage_employees");
    const rows = (
      await db.query(
        "SELECT u.id,u.full_name AS name,u.email FROM users u WHERE u.is_active=true AND NOT EXISTS(SELECT 1 FROM hrm_employees e WHERE e.user_id=u.id) AND (u.full_name ILIKE $1 OR u.email ILIKE $1) ORDER BY u.full_name LIMIT 50",
        [`%${search}%`],
      )
    ).rows;
    return { rows };
  }
  if (type === "projects") {
    const values = [`%${search}%`];
    const s = c.scope(user, values);
    const rows = (
      await db.query(
        `SELECT p.id,p.title AS name,p.client_id FROM projects p WHERE p.title ILIKE $1 AND (${c.can(user, "view_all") ? "TRUE" : `EXISTS(SELECT 1 FROM hrm_allocations a JOIN hrm_employees e ON e.id=a.employee_id WHERE a.project_id=p.id AND a.archived_at IS NULL AND ${s}) OR p.payload->>'assignedTo'=$${values.push(user.id)}`}) ORDER BY p.title LIMIT 50`,
        values,
      )
    ).rows.map(c.camel);
    return { rows };
  }
  if (type === "documents") {
    const values = [`%${search}%`];
    const s = c.scope(user, values);
    values.push(user.id);
    return {
      rows: (
        await db.query(
          `SELECT d.id,d.title AS name,d.employee_id FROM hrm_documents d JOIN hrm_employees e ON e.id=d.employee_id WHERE ${s} AND (e.user_id=$${values.length} OR ${c.can(user, "view_private") ? "TRUE" : "FALSE"}) AND d.title ILIKE $1 ORDER BY d.created_at DESC LIMIT 50`,
          values,
        )
      ).rows.map(c.camel),
    };
  }
  if (type === "records") {
    c.permit(user, "recruitment");
    return {
      rows: (
        await db.query(
          "SELECT id,title AS name,kind FROM hrm_records WHERE kind IN ('job','candidate') AND archived_at IS NULL AND title ILIKE $1 ORDER BY title LIMIT 50",
          [`%${search}%`],
        )
      ).rows,
    };
  }
  if (type === "masters") {
    const rows = (
      await db.query(
        "SELECT id,type,name,is_active,payload FROM master_items WHERE (type LIKE 'hrm_%' OR type='expense_category') ORDER BY name LIMIT 1000",
      )
    ).rows.map(c.camel);
    return {
      rows: rows
        .filter(
          (m) =>
            !["hrm_salary_structure"].includes(m.type) ||
            c.can(user, "view_salary"),
        )
        .map((m) =>
          m.type === "hrm_letter_template" && !c.can(user, "manage_settings")
            ? { ...m, payload: {} }
            : m,
        ),
    };
  }
  c.fail("Unknown lookup", 404);
}
async function masters(user, type, body, id = null, db = null) {
  c.permit(user, "manage_settings");
  c.choice(type, MASTER_TYPES, "Master type");
  c.allow(body, ["name", "isActive", "payload"]);
  return c.transaction(async (tx) => {
    const payload = body.payload || {};
    const keys = {
      // Branch (location) > department > designation drive the employee form's cascading selects.
      department: ["shiftId", "branchId"],
      designation: ["departmentId"],
      team: ["departmentId", "managerId"],
      location: ["address", "timezone"],
      employment_type: [],
      work_category: [],
      shift: [
        "start",
        "end",
        "graceMinutes",
        "minimumHours",
        "halfDayHours",
        "weeklyOffs",
        "breakMinutes",
        "overtimeEnabled",
      ],
      leave_type: [
        "annualDays",
        "paid",
        "halfDayAllowed",
        "sandwich",
        "probationAllowed",
        "employmentTypeIds",
        "accrual",
        "carryForward",
        "carryForwardLimit",
        "encashmentAllowed",
      ],
      salary_structure: ["components"],
      kpi_template: ["factors", "weights"],
      letter_template: ["content", "certificate", "description"],
      attendance_policy: [
        "hoursPerDay",
        "daysPerWeek",
        "geofenceRequired",
        "description",
      ],
      document_type: ["defaultOnCreate", "hasExpiry", "required"],
    };
    c.allow(payload, keys[type]);
    for (const k of [
      "annualDays",
      "carryForwardLimit",
      "graceMinutes",
      "breakMinutes",
    ])
      if (payload[k] != null) c.number(payload[k], k, 0, 1440);
    for (const k of ["minimumHours", "halfDayHours"])
      if (payload[k] != null) c.number(payload[k], k, 0.01, 24);
    for (const k of [
      "paid",
      "halfDayAllowed",
      "sandwich",
      "probationAllowed",
      "carryForward",
      "encashmentAllowed",
      "overtimeEnabled",
      "certificate",
      "geofenceRequired",
      "defaultOnCreate",
      "hasExpiry",
      "required",
    ])
      if (payload[k] != null) c.boolean(payload[k], k);
    if (payload.hoursPerDay != null) c.number(payload.hoursPerDay, "Hours per day", 1, 24);
    if (payload.daysPerWeek != null) c.number(payload.daysPerWeek, "Days per week", 1, 7);
    if (payload.description != null) c.text(payload.description, "Description", 500);
    if (payload.branchId) await c.master(tx, payload.branchId, "location");
    for (const k of ["start", "end"])
      if (payload[k] != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(payload[k]))
        c.fail(`Invalid ${k} time`);
    if (
      payload.weeklyOffs &&
      (!Array.isArray(payload.weeklyOffs) ||
        payload.weeklyOffs.length > 6 ||
        payload.weeklyOffs.some((v) => !Number.isInteger(v) || v < 0 || v > 6))
    )
      c.fail("Invalid shift weekly offs");
    if (payload.accrual) c.choice(payload.accrual, ["yearly", "monthly"]);
    if (payload.departmentId)
      await c.master(tx, payload.departmentId, "department");
    if (payload.shiftId) await c.master(tx, payload.shiftId, "shift");
    if (payload.managerId) await c.employee(tx, user, payload.managerId);
    if (payload.employmentTypeIds) {
      if (!Array.isArray(payload.employmentTypeIds))
        c.fail("Employment types must be a list");
      for (const x of payload.employmentTypeIds)
        await c.master(tx, x, "employment_type", true);
    }
    if (payload.content) c.text(payload.content, "Template content", 30000);
    if (payload.components != null) {
      if (!Array.isArray(payload.components) || payload.components.length > 50)
        c.fail("Provide up to 50 salary components");
      for (const component of payload.components) {
        c.allow(component, ["name", "type", "amount"]);
        c.text(component.name, "Component name", 100, true);
        c.choice(component.type, ["earning", "deduction", "employer"]);
        c.number(component.amount, "Component monthly amount", 0, 1e8);
      }
    }
    const old = id
      ? c.camel(
          (
            await tx.query(
              "SELECT * FROM master_items WHERE id=$1 AND type=$2",
              [id, `hrm_${type}`],
            )
          ).rows[0],
        )
      : null;
    if (id && !old) c.fail("Master not found", 404);
    const values = {
      type: `hrm_${type}`,
      name: c.text(body.name, "Name", 160, true),
      isActive: c.boolean(body.isActive ?? old?.isActive ?? true),
      // The system flag is not editable (it is rejected as an unsupported field), but an edit must not drop it.
      payload: JSON.stringify(old?.payload?.system ? { ...payload, system: true } : payload),
    };
    const saved = id
      ? await c.update(tx, "master_items", id, {
          ...values,
          updatedAt: new Date(),
        })
      : await c.insert(tx, "master_items", values);
    await c.audit(tx, user, "masters", saved.id, "saved", old, saved);
    return saved;
  }, db);
}
// Deleting a master is allowed only while nothing uses it; otherwise HR marks it inactive,
// which hides it from new selections but keeps old records readable.
async function deleteMaster(user, type, id, db = null) {
  c.permit(user, "manage_settings");
  c.choice(type, MASTER_TYPES, "Master type");
  return c.transaction(async (tx) => {
    const old = c.camel(
      (
        await tx.query("SELECT * FROM master_items WHERE id=$1 AND type=$2 FOR UPDATE", [id, `hrm_${type}`])
      ).rows[0],
    );
    if (!old) c.fail("Master not found", 404);
    if (old.payload?.system) c.fail(`"${old.name}" is used by the system and cannot be deleted`, 409);
    const children = (
      await tx.query(
        `SELECT name FROM master_items WHERE type LIKE 'hrm_%' AND id<>$1
           AND (payload->>'branchId'=$1 OR payload->>'departmentId'=$1 OR payload->>'shiftId'=$1) LIMIT 3`,
        [id],
      )
    ).rows.map((r) => r.name);
    if (children.length)
      c.fail(`"${old.name}" is linked to ${children.join(", ")}. Change those first, or mark it inactive.`, 409);
    const policy = await c.policy(tx);
    if (policy.defaultShiftId === id) c.fail(`"${old.name}" is the default shift in HR policies`, 409);
    await tx.query("SAVEPOINT delete_master");
    try {
      await tx.query("DELETE FROM master_items WHERE id=$1", [id]);
    } catch (e) {
      if (e.code !== "23503") throw e;
      await tx.query("ROLLBACK TO SAVEPOINT delete_master");
      c.fail(`"${old.name}" is used by employees or HR records. Mark it inactive instead of deleting.`, 409);
    }
    await c.audit(tx, user, "masters", id, "deleted", old, null);
    return { deleted: true };
  }, db);
}
// A holiday changes the working calendar, so it cannot move or disappear once payroll covers its date.
async function holidayLocked(db, date) {
  const r = await db.query(
    "SELECT 1 FROM hrm_payroll_runs r JOIN hrm_payroll_entries pe ON pe.run_id=r.id WHERE r.start_date<=$1 AND r.end_date>=$1 LIMIT 1",
    [date],
  );
  return r.rowCount > 0;
}
async function removeHoliday(user, id, db = null) {
  c.permit(user, "manage_settings");
  return c.transaction(async (tx) => {
    const old = c.camel((await tx.query("SELECT * FROM hrm_holidays WHERE id=$1 FOR UPDATE", [id])).rows[0]);
    if (!old) c.fail("Holiday not found", 404);
    if (await holidayLocked(tx, old.workDate))
      c.fail("A payroll run already covers this date, so the holiday cannot be removed", 409);
    await tx.query("DELETE FROM hrm_holidays WHERE id=$1", [id]);
    await c.audit(tx, user, "holidays", id, "deleted", old, null);
    return { id, deleted: true };
  }, db);
}
async function holidays(user, body = null, id = null, db = c.dbDefault) {
  if (!body)
    return {
      rows: (
        await db.query(
          "SELECT * FROM hrm_holidays ORDER BY work_date DESC LIMIT 1000",
        )
      ).rows.map(c.camel),
    };
  c.permit(user, "manage_settings");
  c.allow(body, ["name", "workDate", "locationId", "optional"]);
  await c.master(db, body.locationId, "location");
  const values = {
    name: c.text(body.name, "Holiday", 160, true),
    workDate: c.date(body.workDate),
    locationId: body.locationId || null,
    optional: c.boolean(body.optional ?? false),
  };
  return c.transaction(
    async (tx) => {
      const old = id
        ? c.camel(
            (await tx.query("SELECT * FROM hrm_holidays WHERE id=$1", [id]))
              .rows[0],
          )
        : null;
      if (id && !old) c.fail("Holiday not found", 404);
      for (const date of new Set([values.workDate, old?.workDate].filter(Boolean)))
        if (await holidayLocked(tx, date))
          c.fail("A payroll run already covers this date, so the holiday cannot be changed", 409);
      const saved = id
        ? await c.update(tx, "hrm_holidays", id, values)
        : await c.insert(tx, "hrm_holidays", { ...values, createdBy: user.id });
      await c.audit(tx, user, "holidays", saved.id, "saved", old, saved);
      return saved;
    },
    db === c.dbDefault ? null : db,
  );
}
module.exports = { list, lookups, masters, deleteMaster, holidays, removeHoliday };
