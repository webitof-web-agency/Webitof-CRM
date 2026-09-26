const c = require("./core");
const {
  EMPLOYEE_STATUSES,
  WORK_MODES,
  MASTER_TYPES,
  DEFAULT_POLICY,
} = require("../../config/hrm");
const masterFields = {
  departmentId: "department",
  designationId: "designation",
  teamId: "team",
  locationId: "location",
  employmentTypeId: "employment_type",
  shiftId: "shift",
};
const fields = [
  "userId",
  "fullName",
  "companyEmail",
  "phone",
  ...Object.keys(masterFields),
  "managerId",
  "workMode",
  "status",
  "joiningDate",
  "exitDate",
  "probationEnd",
  "contractEnd",
];
const personalFields = [
  "personalEmail",
  "alternateMobile",
  "dob",
  "gender",
  "bloodGroup",
  "maritalStatus",
  "currentAddress",
  "permanentAddress",
  "emergencyContact",
  "noticePeriodDays",
  "probationStart",
  "confirmationDate",
];
function publicEmployee(e) {
  const { profile, ...r } = e;
  return r;
}
async function save(user, body, id = null, db = null) {
  c.permit(user, "manage_employees");
  c.allow(body, [...fields, "effectiveDate", "reason", "version"]);
  return c.transaction(async (tx) => {
    const old = id ? await c.employee(tx, user, id, { lock: true }) : null;
    if (old) c.optimistic(old, body);
    const v = { ...old, ...body };
    const p = await c.policy(tx);
    const result = {};
    for (const [key, type] of Object.entries(masterFields)) {
      await c.master(tx, v[key], type);
      result[key] = v[key] || null;
    }
    if (v.userId) {
      const u = await tx.query(
        "SELECT id,full_name,email,phone FROM users WHERE id=$1",
        [v.userId],
      );
      if (!u.rows[0]) c.fail("Linked user does not exist");
      v.fullName = v.fullName || u.rows[0].full_name;
      v.companyEmail = v.companyEmail || u.rows[0].email;
    }
    if (old && old.userId !== (v.userId || null))
      c.fail("An existing employee login mapping cannot be reassigned");
    result.userId = v.userId || null;
    result.fullName = c.text(v.fullName, "Full name", 160, true);
    result.companyEmail = c.text(v.companyEmail, "Company email", 254);
    result.phone = c.text(v.phone, "Phone", 40);
    if (
      result.companyEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.companyEmail)
    )
      c.fail("Invalid company email");
    result.status = c.choice(
      v.status || "Draft",
      EMPLOYEE_STATUSES,
      "Employment status",
    );
    result.workMode = c.choice(v.workMode || "Office", WORK_MODES, "Work mode");
    result.joiningDate = c.date(v.joiningDate, "Joining date");
    for (const key of ["exitDate", "probationEnd", "contractEnd"])
      result[key] = c.date(v[key], key, true);
    if (result.exitDate && result.exitDate < result.joiningDate)
      c.fail("Exit precedes joining");
    result.managerId = v.managerId || null;
    if (result.managerId) {
      await c.employee(tx, user, result.managerId);
      const r = await tx.query(
        `WITH RECURSIVE chain AS (SELECT id,manager_id FROM hrm_employees WHERE id=$1 UNION SELECT e.id,e.manager_id FROM hrm_employees e JOIN chain x ON e.id=x.manager_id) SELECT id FROM chain WHERE id=$2`,
        [result.managerId, id || ""],
      );
      if (r.rowCount) c.fail("Reporting hierarchy cannot contain a cycle");
    }
    const effectiveDate = c.date(
      body.effectiveDate || result.joiningDate,
      "Effective date",
    );
    if (old && effectiveDate > c.today(p))
      c.fail(
        "Future employment changes must be applied on their effective date",
      );
    if (old) {
      const latest = await tx.query(
        "SELECT max(effective_date)::text AS date FROM hrm_employment_history WHERE employee_id=$1",
        [id],
      );
      if (effectiveDate < latest.rows[0].date)
        c.fail("Employment changes cannot precede the latest history record");
    }
    const saved = old
      ? await c.update(tx, "hrm_employees", id, {
          ...result,
          updatedAt: new Date(),
          version: old.version + 1,
        })
      : await c.insert(tx, "hrm_employees", {
          ...result,
          employeeNumber: `${p.employeePrefix}-${(await tx.query("SELECT nextval('hrm_employee_number') AS n")).rows[0].n}`,
          createdBy: user.id,
        });
    await c.insert(tx, "hrm_employment_history", {
      employeeId: saved.id,
      effectiveDate,
      snapshot: JSON.stringify(publicEmployee(saved)),
      reason: c.text(body.reason || "Employee created", "Reason", 1000, true),
      createdBy: user.id,
    });
    if (!old)
      for (const title of p.onboardingChecklist)
        await c.insert(tx, "hrm_records", {
          kind: "onboarding",
          employeeId: saved.id,
          title,
          status: "Pending",
          createdBy: user.id,
        });
    await c.audit(
      tx,
      user,
      "employees",
      saved.id,
      old ? "updated" : "created",
      old ? publicEmployee(old) : null,
      publicEmployee(saved),
      saved.id,
    );
    if (saved.managerId) {
      const m = await tx.query(
        "SELECT user_id FROM hrm_employees WHERE id=$1",
        [saved.managerId],
      );
      await c.notify(
        tx,
        m.rows[0]?.user_id,
        "Employee profile updated",
        saved.id,
        user.id,
      );
    }
    return publicEmployee(saved);
  }, db);
}
async function list(user, q = {}, db = c.dbDefault) {
  const { page, limit } = c.page(q);
  const values = [];
  const clauses = ["e.archived_at IS NULL", c.scope(user, values)];
  for (const key of [
    "id",
    "departmentId",
    "designationId",
    "managerId",
    "employmentTypeId",
    "status",
    "workMode",
    "teamId",
  ])
    if (q[key] || (key === "id" && q.employeeId)) {
      values.push(q[key] || q.employeeId);
      clauses.push(`e.${c.snake(key)}=$${values.length}`);
    }
  if (q.search) {
    values.push(`%${c.text(q.search, "Search", 160)}%`);
    clauses.push(
      `(e.full_name ILIKE $${values.length} OR e.employee_number ILIKE $${values.length})`,
    );
  }
  const where = clauses.join(" AND ");
  const count = await db.query(
    `SELECT count(*)::int AS total FROM hrm_employees e WHERE ${where}`,
    values,
  );
  values.push(limit, (page - 1) * limit);
  const rows = await db.query(
    `SELECT e.*,d.name AS department_name,g.name AS designation_name,m.full_name AS manager_name FROM hrm_employees e LEFT JOIN master_items d ON d.id=e.department_id LEFT JOIN master_items g ON g.id=e.designation_id LEFT JOIN hrm_employees m ON m.id=e.manager_id WHERE ${where} ORDER BY e.full_name,e.id LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return {
    rows: rows.rows.map((r) => publicEmployee(c.camel(r))),
    total: count.rows[0].total,
    page,
    limit,
  };
}
async function detail(user, id, db = c.dbDefault) {
  const e = await c.employee(db, user, id);
  return {
    ...publicEmployee(e),
    ...(e.userId === user.id || c.can(user, "view_private")
      ? { profile: e.profile }
      : {}),
  };
}
async function privateProfile(user, id, body = null, db = null) {
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, id, { lock: Boolean(body) });
    if (body) {
      c.permit(user, "manage_private");
      c.allow(body, ["profile", "financial"]);
      if (body.profile) c.allow(body.profile, personalFields);
      if (body.financial) {
        c.permit(user, "manage_salary");
        c.allow(body.financial, [
          "bankName",
          "accountNumber",
          "ifsc",
          "pan",
          "uan",
          "pfApplicable",
          "esiApplicable",
          "statutory",
        ]);
      }
      const old =
        (
          await tx.query(
            "SELECT details FROM hrm_private_profiles WHERE employee_id=$1",
            [id],
          )
        ).rows[0]?.details || {};
      if (body.profile)
        await c.update(tx, "hrm_employees", id, {
          profile: JSON.stringify(body.profile),
          updatedAt: new Date(),
        });
      if (body.financial)
        await tx.query(
          "INSERT INTO hrm_private_profiles(employee_id,details) VALUES($1,$2) ON CONFLICT(employee_id) DO UPDATE SET details=excluded.details,updated_at=now()",
          [id, JSON.stringify(body.financial)],
        );
      await c.audit(
        tx,
        user,
        "private",
        id,
        "updated",
        { profile: e.profile, financial: old },
        body,
        id,
        true,
      );
      return { saved: true };
    }
    c.permit(user, "view_private");
    const r = { profile: e.profile };
    if (c.can(user, "view_salary"))
      r.financial =
        (
          await tx.query(
            "SELECT details FROM hrm_private_profiles WHERE employee_id=$1",
            [id],
          )
        ).rows[0]?.details || {};
    return r;
  }, db);
}
async function archive(user, id, db = null) {
  c.permit(user, "manage_employees");
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, id, { lock: true });
    if (!["Draft", "Inactive", "Relieved", "Terminated"].includes(e.status))
      c.fail("Set an appropriate inactive or exit status before archiving");
    const r = await c.update(tx, "hrm_employees", id, {
      archivedAt: new Date(),
      version: e.version + 1,
    });
    await c.audit(
      tx,
      user,
      "employees",
      id,
      "archived",
      publicEmployee(e),
      publicEmployee(r),
      id,
    );
    return { archived: true };
  }, db);
}
async function savePolicy(user, body, db = null) {
  c.permit(user, "manage_settings");
  c.allow(body, Object.keys(DEFAULT_POLICY));
  return c.transaction(async (tx) => {
    const old = await c.policy(tx);
    const v = { ...old, ...body };
    try {
      new Intl.DateTimeFormat("en", { timeZone: v.timezone });
    } catch {
      c.fail("Invalid timezone");
    }
    for (const [k, defaultValue] of Object.entries(DEFAULT_POLICY)) {
      if (typeof defaultValue === "boolean") c.boolean(v[k], k);
      if (typeof defaultValue === "number")
        c.number(v[k], k, 0, k.includes("Utilization") ? 500 : 1000);
    }
    for (const k of ["shiftStart", "shiftEnd", "reportDeadline"])
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v[k])) c.fail(`Invalid ${k}`);
    if (
      v.standardDailyHours <= 0 ||
      v.standardDailyHours > 24 ||
      v.maxReportHours > 24
    )
      c.fail("Daily hours must be between 0 and 24");
    if (
      !Array.isArray(v.weeklyOffs) ||
      v.weeklyOffs.length > 6 ||
      v.weeklyOffs.some((x) => !Number.isInteger(x) || x < 0 || x > 6)
    )
      c.fail("Invalid weekly off days");
    for (const k of ["onboardingChecklist", "offboardingChecklist"])
      if (
        !Array.isArray(v[k]) ||
        v[k].length > 50 ||
        v[k].some((t) => typeof t !== "string" || !t.trim() || t.length > 200)
      )
        c.fail(`Invalid ${k}`);
    if (
      !(
        v.underUtilization < v.highUtilization &&
        v.highUtilization <= v.overloadUtilization
      )
    )
      c.fail("Utilization thresholds must be ascending");
    if (
      !/^[A-Z]{3}$/.test(v.currency) ||
      !/^[A-Za-z0-9-]{1,12}$/.test(v.employeePrefix)
    )
      c.fail("Invalid currency or employee prefix");
    await c.master(tx, v.defaultShiftId, "shift");
    await tx.query(
      "UPDATE hrm_settings SET value=$1,updated_by=$2,updated_at=now() WHERE key='policy'",
      [JSON.stringify(v), user.id],
    );
    await c.audit(tx, user, "settings", "policy", "updated", old, v);
    return v;
  }, db);
}
module.exports = {
  save,
  list,
  detail,
  privateProfile,
  archive,
  savePolicy,
  publicEmployee,
  MASTER_TYPES,
};
