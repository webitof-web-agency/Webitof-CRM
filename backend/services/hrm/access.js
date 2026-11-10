// Login access follows employment status. While an employee is Suspended, Relieved, Terminated
// or Inactive, the linked ERP login is switched off (users.is_active=false). requireAuth checks
// that flag on every request, so an open web or app session stops on its next call.
//
// The login is marked with payload.hrmBlocked, so a reinstatement only switches on a login
// that HR switched off. A login an admin disabled from Users stays disabled, and Users cannot
// switch on a login HR blocked: that goes through Reinstate.
//
// Employee records, attendance, payroll and documents are never deleted; the Employee ID
// stays reserved for that person.
const c = require("./core");
const { EMPLOYEE_STATUSES } = require("../../config/hrm");

const BLOCKED_STATUSES = ["Suspended", "Relieved", "Terminated", "Inactive"];
const WORKING_STATUSES = EMPLOYEE_STATUSES.filter(
  (s) => s !== "Draft" && !BLOCKED_STATUSES.includes(s),
);
const isBlocked = (status) => BLOCKED_STATUSES.includes(status);

// Shown on the login screen when HR switched the login off.
function blockedLoginMessage(block) {
  if (!block) return "Your account is disabled. Please contact the administrator.";
  if (block.status === "Suspended")
    return "Your account is suspended. Please contact HR.";
  return "Your employment has ended, so this login is no longer active. Please contact HR if this is a mistake.";
}

// Blocking the only active super admin would lock everyone out of user management.
async function guardLastAdmin(tx, userId) {
  const r = await tx.query(
    `SELECT bool_or(u.id=$1) AS target_is_admin, count(DISTINCT u.id) FILTER (WHERE u.id<>$1) AS others
     FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles ro ON ro.id=ur.role_id
     WHERE ro.code='admin' AND ro.is_active=true AND u.is_active=true`,
    [userId],
  );
  const row = r.rows[0] || {};
  if (row.target_is_admin && Number(row.others) === 0)
    c.fail("This is the only active admin login; it cannot be blocked", 409);
}

// Brings the linked login in line with the employee's status. Safe to call after any change.
async function syncLogin(tx, user, employee) {
  if (!employee.userId) return { login: "none", changed: false };
  const u = (
    await tx.query("SELECT id,is_active,payload FROM users WHERE id=$1 FOR UPDATE", [
      employee.userId,
    ])
  ).rows[0];
  if (!u) return { login: "none", changed: false };
  const block = u.payload?.hrmBlocked || null;

  if (isBlocked(employee.status)) {
    const mark = {
      status: employee.status,
      employeeId: employee.id,
      at: new Date().toISOString(),
      by: user.id,
    };
    if (u.is_active) {
      if (u.id === user.id) c.fail("You cannot block your own login", 409);
      await guardLastAdmin(tx, u.id);
      await tx.query(
        "UPDATE users SET is_active=false,payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('hrmBlocked',$2::jsonb),updated_at=now() WHERE id=$1",
        [u.id, JSON.stringify(mark)],
      );
      // No push notifications to a phone whose owner has lost access.
      await tx.query("DELETE FROM hrm_devices WHERE user_id=$1", [u.id]);
      c.afterCommit(tx, () => require("../socketHub.service").disconnectUser?.(u.id));
      return { login: "blocked", changed: true };
    }
    // Already off. Keep HR's note current (e.g. Suspended -> Terminated) for the login message.
    if (block && block.status !== employee.status)
      await tx.query(
        "UPDATE users SET payload=payload||jsonb_build_object('hrmBlocked',$2::jsonb) WHERE id=$1",
        [u.id, JSON.stringify({ ...block, ...mark })],
      );
    return { login: block ? "blocked" : "disabled", changed: false };
  }

  if (!u.is_active && block) {
    await tx.query(
      "UPDATE users SET is_active=true,payload=payload-'hrmBlocked',updated_at=now() WHERE id=$1",
      [u.id],
    );
    return { login: "restored", changed: true };
  }
  return { login: u.is_active ? "active" : "disabled", changed: false };
}

// The latest status the employee had before being blocked, for a plain reinstatement.
async function previousWorkingStatus(tx, employeeId) {
  const r = await tx.query(
    `SELECT snapshot->>'status' AS status FROM hrm_employment_history
     WHERE employee_id=$1 AND snapshot->>'status' = ANY($2::text[])
     ORDER BY effective_date DESC, created_at DESC LIMIT 1`,
    [employeeId, WORKING_STATUSES],
  );
  return r.rows[0]?.status || "Active";
}

async function historyDate(tx, employeeId, today) {
  const r = await tx.query(
    "SELECT max(effective_date)::text AS date FROM hrm_employment_history WHERE employee_id=$1",
    [employeeId],
  );
  const latest = r.rows[0]?.date;
  return latest && latest > today ? latest : today;
}

async function applyStatus(tx, user, e, { status, exitDate, reason, action, p }) {
  const patch = { status, updatedAt: new Date(), version: e.version + 1 };
  if (exitDate !== undefined) patch.exitDate = exitDate;
  const saved = await c.update(tx, "hrm_employees", e.id, patch);
  const login = await syncLogin(tx, user, saved);
  const { profile, ...snapshot } = saved;
  await c.insert(tx, "hrm_employment_history", {
    employeeId: e.id,
    effectiveDate: await historyDate(tx, e.id, c.today(p)),
    snapshot: JSON.stringify(snapshot),
    reason,
    createdBy: user.id,
  });
  await c.audit(
    tx,
    user,
    "employees",
    e.id,
    action,
    { status: e.status, exitDate: e.exitDate || null },
    { status, exitDate: saved.exitDate || null, reason, login: login.login },
    e.id,
  );
  return { employee: snapshot, login: login.login };
}

function hrOnly(user) {
  c.permit(user, "manage_employees", "hr_approve");
  if (!c.can(user, "hr_approve")) c.fail("Final HR approval required", 403);
}

// Temporary stop, e.g. during an inquiry. Reinstate brings the employee and login back.
async function suspend(user, id, body = {}, db = null) {
  hrOnly(user);
  c.allow(body, ["reason", "version"]);
  const reason = c.text(body.reason, "Reason", 1000, true);
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, id, { lock: true });
    if (body.version != null) c.optimistic(e, body);
    if (isBlocked(e.status)) c.fail(`Employee is already ${e.status}`, 409);
    return applyStatus(tx, user, e, {
      status: "Suspended",
      reason: `Suspended: ${reason}`,
      action: "suspended",
      p: await c.policy(tx),
    });
  }, db);
}

// Immediate exit without the notice-period flow. Exit checklist items are added (once) so
// assets and settlement can still be tracked.
async function terminate(user, id, body = {}, db = null) {
  hrOnly(user);
  c.allow(body, ["reason", "exitDate", "version"]);
  const reason = c.text(body.reason, "Reason", 1000, true);
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, id, { lock: true });
    if (body.version != null) c.optimistic(e, body);
    if (["Relieved", "Terminated"].includes(e.status))
      c.fail(`Employee is already ${e.status}`, 409);
    const p = await c.policy(tx);
    const today = c.today(p);
    // Someone who never joined leaves on the joining date (exit cannot precede joining).
    const fallback = e.joiningDate > today ? e.joiningDate : today;
    const exitDate = c.date(body.exitDate, "Last working date", true) || fallback;
    if (exitDate < e.joiningDate) c.fail("Last working date cannot be before the joining date");
    if (exitDate > fallback)
      c.fail("Last working date cannot be in the future. For a later exit, put the employee on Notice Period.");
    const existing = await tx.query(
      "SELECT 1 FROM hrm_records WHERE employee_id=$1 AND kind='offboarding' AND archived_at IS NULL LIMIT 1",
      [e.id],
    );
    if (!existing.rowCount)
      for (const title of p.offboardingChecklist)
        await c.insert(tx, "hrm_records", {
          kind: "offboarding",
          employeeId: e.id,
          title,
          status: "Pending",
          endDate: exitDate,
          createdBy: user.id,
        });
    return applyStatus(tx, user, e, {
      status: "Terminated",
      exitDate,
      reason: `Terminated: ${reason}`,
      action: "terminated",
      p,
    });
  }, db);
}

// Ends a suspension, or takes back someone who left (same record and Employee ID; the exit
// date is cleared). The login comes back only if HR had blocked it.
async function reinstate(user, id, body = {}, db = null) {
  hrOnly(user);
  c.allow(body, ["reason", "status", "version"]);
  const reason = c.text(body.reason, "Reason", 1000, true);
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, id, { lock: true });
    if (body.version != null) c.optimistic(e, body);
    if (!isBlocked(e.status)) c.fail("Only a suspended or exited employee can be reinstated", 409);
    const status = body.status
      ? c.choice(body.status, WORKING_STATUSES, "Status")
      : await previousWorkingStatus(tx, e.id);
    const rejoining = e.status !== "Suspended";
    const keepExit = status === "Notice Period" && e.exitDate;
    return applyStatus(tx, user, e, {
      status,
      exitDate: keepExit ? e.exitDate : rejoining ? null : undefined,
      reason: `${rejoining ? "Rejoined" : "Reinstated"}: ${reason}`,
      action: rejoining ? "rejoined" : "reinstated",
      p: await c.policy(tx),
    });
  }, db);
}

module.exports = {
  BLOCKED_STATUSES,
  WORKING_STATUSES,
  isBlocked,
  blockedLoginMessage,
  syncLogin,
  suspend,
  terminate,
  reinstate,
};
