const c = require("./core");
const rules = require("./validators");
const bcrypt = require("bcryptjs");
const { createId } = require("../../utils/format");
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
  "employeeCode",
  "attendancePolicyId",
  "photoDocumentId",
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
  // Structured contact details from the employee wizard.
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "country",
  "postalCode",
  "emergencyName",
  "emergencyRelationship",
  "emergencyPhone",
];
const financialFields = [
  "bankName",
  "accountHolderName",
  "accountNumber",
  "ifsc",
  "bankBranch",
  "pan",
  "uan",
  "pfApplicable",
  "esiApplicable",
  "statutory",
  "hoursPerDay",
  "daysPerWeek",
];
const GENDERS = ["Male", "Female", "Other"];

// Login for an employee created from the wizard gets the Employee role only, so HR staff
// without user-management rights cannot hand out anything beyond self service.
async function createEmployeeLogin(tx, user, login, employee) {
  c.allow(login, ["email", "password"]);
  const email = c.text(login.email, "Login email", 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) c.fail("Invalid login email");
  const password = String(login.password || "");
  if (password.length < 8)
    c.fail("Login password must be at least 8 characters");
  const taken = await tx.query(
    "SELECT 1 FROM users WHERE lower(email)=$1 OR lower(username)=$1",
    [email],
  );
  if (taken.rowCount)
    c.fail(
      "A login with this email already exists. Pick it as the existing ERP login instead.",
      409,
    );
  const role = (
    await tx.query(
      "SELECT id FROM roles WHERE code='employee' AND is_active=true",
    )
  ).rows[0];
  if (!role)
    c.fail(
      "The Employee role is missing. Run the HRM migration (npm run migrate:hrm).",
      503,
    );
  const id = createId("user");
  await tx.query(
    "INSERT INTO users(id,full_name,username,email,phone,gender,password_hash,is_active,payload) VALUES($1,$2,$3,$3,$4,$5,$6,true,'{}'::jsonb)",
    [
      id,
      employee.fullName,
      email,
      employee.phone || null,
      employee.gender || null,
      await bcrypt.hash(password, 10),
    ],
  );
  await tx.query(
    "INSERT INTO user_roles(user_id,role_id,assigned_by) VALUES($1,$2,$3)",
    [id, role.id, user.id],
  );
  return id;
}

// A linked login keeps its own roles (e.g. Sales); if none of them gives HRM self service,
// the Employee role is added so My day and the Employee app work. Same minimal grant as a
// login created from the wizard, so no user-management rights are needed.
async function ensureSelfService(tx, user, userId) {
  const r = await tx.query(
    `SELECT bool_or(ro.code='admin') AS admin,
            count(DISTINCT p.code) FILTER (WHERE p.code IN ('hrm.view_own','hrm.self_service')) AS self
     FROM user_roles ur
     JOIN roles ro ON ro.id=ur.role_id AND ro.is_active=true
     LEFT JOIN role_permissions rp ON rp.role_id=ro.id
     LEFT JOIN permissions p ON p.id=rp.permission_id
     WHERE ur.user_id=$1`,
    [userId],
  );
  const row = r.rows[0] || {};
  if (row.admin || Number(row.self) >= 2) return;
  const role = (
    await tx.query("SELECT id FROM roles WHERE code='employee' AND is_active=true")
  ).rows[0];
  if (!role)
    c.fail("The Employee role is missing. Run the HRM migration (npm run migrate:hrm).", 503);
  await tx.query(
    "INSERT INTO user_roles(user_id,role_id,assigned_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
    [userId, role.id, user.id],
  );
}

// Base salary from the wizard. The first record starts on the joining date and is corrected
// in place until the employee joins; after that a change is a revision dated today (or
// corrects today's revision in place).
async function saveSalary(tx, user, employee, salary, p, onboarding) {
  c.permit(user, "manage_salary");
  c.allow(salary, ["monthlyCost", "currency"]);
  const monthlyCost = c.number(salary.monthlyCost, "Base salary", 0, 1e9);
  const currency = c.text(salary.currency || "INR", "Currency", 3, true).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) c.fail("Currency must be a 3-letter code such as INR");
  const latest = (
    await tx.query(
      "SELECT id,effective_date::text AS date,monthly_cost FROM hrm_salary_history WHERE employee_id=$1 ORDER BY effective_date DESC LIMIT 1",
      [employee.id],
    )
  ).rows[0];
  if (latest && Number(latest.monthly_cost) === monthlyCost) return;
  const effectiveDate = onboarding || !latest ? employee.joiningDate : c.today(p);
  if (latest && (onboarding || latest.date === effectiveDate)) {
    await tx.query(
      "UPDATE hrm_salary_history SET monthly_cost=$2,currency=$3,effective_date=$4 WHERE id=$1",
      [latest.id, monthlyCost, currency, effectiveDate],
    );
  } else if (latest && latest.date > effectiveDate) {
    c.fail("A later salary revision exists; change it from Compensation");
  } else {
    await c.insert(tx, "hrm_salary_history", {
      employeeId: employee.id,
      effectiveDate,
      monthlyCost,
      currency,
      components: "[]",
      reason: onboarding ? "Joining salary" : "Updated from employee profile",
      createdBy: user.id,
    });
  }
  await c.audit(
    tx,
    user,
    "salary-history",
    employee.id,
    "updated",
    latest ? { monthlyCost: latest.monthly_cost } : null,
    { monthlyCost, currency },
    employee.id,
    true,
  );
}

// Cleaned in place before storing, for the employee form and the /private endpoint alike:
// digits-only phones and PIN, letter-only names, lower-case email, valid date of birth.
async function cleanProfile(tx, profile) {
  if (profile.gender) c.choice(profile.gender, GENDERS, "Gender");
  if (profile.dob) profile.dob = rules.dateOfBirth(profile.dob, c.today(await c.policy(tx)));
  if (profile.emergencyName != null)
    profile.emergencyName = rules.personName(profile.emergencyName, "Emergency contact name") || "";
  for (const [k, title] of [
    ["emergencyPhone", "Emergency contact phone"],
    ["alternateMobile", "Alternate mobile"],
  ])
    if (profile[k] != null) profile[k] = rules.phone(profile[k], title) || "";
  if (profile.personalEmail != null)
    profile.personalEmail = rules.email(profile.personalEmail, "Personal email") || "";
  if (profile.postalCode != null) profile.postalCode = rules.pin(profile.postalCode) || "";
}

// PAN/IFSC stored upper-case; account number and UAN digits only.
function cleanFinancial(financial) {
  if (financial.ifsc != null) financial.ifsc = rules.ifsc(financial.ifsc) || "";
  if (financial.pan != null) financial.pan = rules.pan(financial.pan) || "";
  if (financial.accountNumber != null) financial.accountNumber = rules.accountNumber(financial.accountNumber) || "";
  if (financial.uan != null) financial.uan = rules.uan(financial.uan) || "";
  if (financial.accountHolderName != null)
    financial.accountHolderName = rules.personName(financial.accountHolderName, "Account holder name") || "";
}

// Personal (profile) and bank details sent with the employee form; same rules as /private.
async function savePrivate(tx, user, employee, profile, financial) {
  if (profile) {
    c.permit(user, "manage_private");
    c.allow(profile, personalFields);
    await cleanProfile(tx, profile);
    await c.update(tx, "hrm_employees", employee.id, {
      profile: JSON.stringify(profile),
      updatedAt: new Date(),
    });
  }
  if (financial) {
    c.permit(user, "manage_salary");
    c.allow(financial, financialFields);
    cleanFinancial(financial);
    for (const [k, title, min, max] of [
      ["hoursPerDay", "Hours per day", 1, 24],
      ["daysPerWeek", "Days per week", 1, 7],
    ])
      if (financial[k] !== "" && financial[k] != null)
        c.number(financial[k], title, min, max);
    await tx.query(
      "INSERT INTO hrm_private_profiles(employee_id,details) VALUES($1,$2) ON CONFLICT(employee_id) DO UPDATE SET details=excluded.details,updated_at=now()",
      [employee.id, JSON.stringify(financial)],
    );
  }
  if (profile || financial)
    await c.audit(
      tx,
      user,
      "private",
      employee.id,
      "updated",
      null,
      { profile: Boolean(profile), financial: Boolean(financial) },
      employee.id,
      true,
    );
}
function publicEmployee(e) {
  const { profile, ...r } = e;
  return r;
}
async function save(user, body, id = null, db = null) {
  c.permit(user, "manage_employees");
  c.allow(body, [
    ...fields,
    "effectiveDate",
    "reason",
    "version",
    "profile",
    "financial",
    "salary",
    "login",
  ]);
  const { profile, financial, salary, login, ...core } = body;
  body = core;
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
    // A login can be attached to an employee that has none (at creation or later), but an
    // existing mapping is never moved or removed: attendance and payroll history hang off it.
    if (old?.userId && old.userId !== (v.userId || null))
      c.fail("An existing employee login mapping cannot be reassigned");
    const linkingLogin = Boolean(v.userId) && v.userId !== (old?.userId || null);
    if (linkingLogin) {
      const u = (
        await tx.query(
          "SELECT id,full_name,email,phone,is_active FROM users WHERE id=$1",
          [v.userId],
        )
      ).rows[0];
      if (!u) c.fail("Linked user does not exist");
      if (!u.is_active) c.fail("This login is inactive. Activate it from Users first.");
      const other = (
        await tx.query(
          "SELECT employee_number,full_name,archived_at FROM hrm_employees WHERE user_id=$1 AND id<>$2",
          [v.userId, id || ""],
        )
      ).rows[0];
      if (other)
        c.fail(
          other.archived_at
            ? `This login belongs to archived employee ${other.full_name} (${other.employee_number}).`
            : `This login is already linked to employee ${other.full_name} (${other.employee_number}).`,
          409,
        );
      v.fullName = v.fullName || u.full_name;
      v.companyEmail = v.companyEmail || u.email;
      v.phone = v.phone || u.phone;
    }
    result.userId = v.userId || null;
    if (login && result.userId) c.fail("This employee already has a login");
    result.fullName = rules.personName(v.fullName, "Full name", true);
    result.employeeCode = rules.employeeCode(v.employeeCode);
    if (result.employeeCode) {
      const dup = await tx.query(
        "SELECT 1 FROM hrm_employees WHERE lower(employee_code)=lower($1) AND archived_at IS NULL AND id<>$2",
        [result.employeeCode, id || ""],
      );
      if (dup.rowCount)
        c.fail("Another employee already uses this employee code", 409);
    }
    await c.master(tx, v.attendancePolicyId, "attendance_policy");
    result.attendancePolicyId = v.attendancePolicyId || null;
    if (old && v.photoDocumentId) {
      const doc = await tx.query(
        "SELECT 1 FROM hrm_documents WHERE id=$1 AND employee_id=$2 AND mime_type LIKE 'image/%'",
        [v.photoDocumentId, id],
      );
      if (!doc.rowCount)
        c.fail("Profile photo must be an image uploaded for this employee");
    }
    result.photoDocumentId = (old && v.photoDocumentId) || null;
    result.companyEmail = rules.email(v.companyEmail, "Company email");
    result.phone = rules.phone(v.phone, "Phone");
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
    // Before the joining date an edit is a correction of the onboarding record, not an
    // employment change, so it rewrites the joining history entry instead of appending one.
    const preJoining = Boolean(old) && old.joiningDate > c.today(p);
    const effectiveDate = preJoining
      ? result.joiningDate
      : c.date(body.effectiveDate || result.joiningDate, "Effective date");
    if (old && !preJoining && effectiveDate > c.today(p))
      c.fail(
        "Future employment changes must be applied on their effective date",
      );
    if (old && !preJoining) {
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
    if (login) {
      const userId = await createEmployeeLogin(tx, user, login, {
        ...saved,
        gender: profile?.gender,
      });
      Object.assign(
        saved,
        await c.update(tx, "hrm_employees", saved.id, { userId }),
      );
    }
    if (linkingLogin) await ensureSelfService(tx, user, result.userId);
    await savePrivate(tx, user, saved, profile, financial);
    // A moved joining date carries the joining salary with it, so payroll never finds a gap.
    if (preJoining && old.joiningDate !== saved.joiningDate)
      await tx.query(
        "UPDATE hrm_salary_history SET effective_date=$3 WHERE employee_id=$1 AND effective_date=$2",
        [saved.id, old.joiningDate, saved.joiningDate],
      );
    if (salary && salary.monthlyCost !== "" && salary.monthlyCost != null)
      await saveSalary(tx, user, saved, salary, p, !old || preJoining);
    const historyReason = c.text(
      body.reason || (old ? "Onboarding details corrected" : "Employee created"),
      "Reason",
      1000,
      true,
    );
    if (preJoining)
      await tx.query(
        "UPDATE hrm_employment_history SET effective_date=$2,snapshot=$3,reason=$4 WHERE employee_id=$1",
        [saved.id, effectiveDate, JSON.stringify(publicEmployee(saved)), historyReason],
      );
    else
      await c.insert(tx, "hrm_employment_history", {
        employeeId: saved.id,
        effectiveDate,
        snapshot: JSON.stringify(publicEmployee(saved)),
        reason: historyReason,
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
      if (body.profile) {
        c.allow(body.profile, personalFields);
        await cleanProfile(tx, body.profile);
      }
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
        cleanFinancial(body.financial);
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
    for (const k of [
      "shiftStart",
      "shiftEnd",
      "reportDeadline",
      "lunchWindowStart",
      "lunchWindowEnd",
    ])
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v[k])) c.fail(`Invalid ${k}`);
    if (v.lunchWindowStart >= v.lunchWindowEnd)
      c.fail("Lunch window must end after it starts");
    if (v.reportIntervalMinutes < 15 || v.reportIntervalMinutes > 240)
      c.fail("Report interval must be between 15 and 240 minutes");
    if (v.pingIntervalMinutes < 1 || v.offlineAfterMinutes <= v.pingIntervalMinutes)
      c.fail("Offline threshold must be longer than the location ping interval");
    if (v.defaultOfficeRadiusMeters < 20 || v.defaultHomeRadiusMeters < 20)
      c.fail("Geofence radius must be at least 20 metres");
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
