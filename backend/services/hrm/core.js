const { query, withTransaction } = require("../../config/db");
const { createId } = require("../../utils/format");
const { hasPermission } = require("../../middlewares/auth");
const { DEFAULT_POLICY } = require("../../config/hrm");
const dbDefault = { query };
function fail(message, statusCode = 400) {
  const e = new Error(message);
  e.statusCode = statusCode;
  throw e;
}
function permit(user, ...actions) {
  if (!actions.some((a) => hasPermission(user, `hrm.${a}`)))
    fail("You do not have permission for this HR action", 403);
}
function can(user, action) {
  return hasPermission(user, `hrm.${action}`);
}
function text(value, label = "Value", max = 4000, required = false) {
  if (value == null || value === "") {
    if (required) fail(`${label} is required`);
    return null;
  }
  if (typeof value !== "string" || value.length > max)
    fail(`${label} must be text up to ${max} characters`);
  return value.trim();
}
function number(value, label, min = 0, max = 1e9) {
  if (value === "" || value == null || typeof value === "boolean")
    fail(`${label} is required`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max)
    fail(`${label} must be between ${min} and ${max}`);
  return n;
}
function date(value, label = "Date", optional = false) {
  if (optional && !value) return null;
  const s = String(value || "");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ||
    new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) !== s
  )
    fail(`${label} must be a valid calendar date`);
  return s;
}
function instant(value, label = "Time", optional = false) {
  if (optional && !value) return null;
  if (
    typeof value !== "string" ||
    !/(Z|[+-]\d\d:\d\d)$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    fail(`${label} must include a timezone`);
  return new Date(value).toISOString();
}
function choice(value, values, label = "Value") {
  if (!values.includes(value))
    fail(`${label} must be one of: ${values.join(", ")}`);
  return value;
}
function boolean(value, label = "Value") {
  if (typeof value !== "boolean") fail(`${label} must be true or false`);
  return value;
}
function allow(data, keys) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail("An object is required");
  const invalid = Object.keys(data).filter((k) => !keys.includes(k));
  if (invalid.length) fail(`Unsupported fields: ${invalid.join(", ")}`);
}
function camel(row) {
  if (!row) return null;
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      v,
    ]),
  );
}
function snake(key) {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
async function insert(db, table, values) {
  const data = { id: createId("hrm"), ...values };
  const keys = Object.keys(data);
  const r = await db.query(
    `INSERT INTO ${table} (${keys.map(snake).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
    Object.values(data),
  );
  return camel(r.rows[0]);
}
async function update(db, table, id, values) {
  const keys = Object.keys(values);
  const r = await db.query(
    `UPDATE ${table} SET ${keys.map((k, i) => `${snake(k)}=$${i + 2}`).join(",")} WHERE id=$1 RETURNING *`,
    [id, ...Object.values(values)],
  );
  return camel(r.rows[0]);
}
async function policy(db = dbDefault) {
  const r = await db.query("SELECT value FROM hrm_settings WHERE key='policy'");
  return { ...DEFAULT_POLICY, ...r.rows[0]?.value };
}
function today(p, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: p.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
function range(q, p) {
  const end = date(q.endDate || today(p));
  const start = date(q.startDate || `${end.slice(0, 7)}-01`);
  if (end < start || (Date.parse(end) - Date.parse(start)) / 86400000 > 366)
    fail("Select a date range of at most 367 days");
  return { start, end };
}
function days(start, end) {
  const output = [];
  for (let d = Date.parse(start); d <= Date.parse(end); d += 86400000) {
    output.push(new Date(d).toISOString().slice(0, 10));
    if (output.length > 367) fail("Date range is too large");
  }
  return output;
}
function scope(user, values, alias = "e") {
  if (can(user, "view_all")) return "TRUE";
  values.push(user.id);
  const u = `$${values.length}`;
  const parts = [];
  if (can(user, "view_own")) parts.push(`${alias}.user_id=${u}`);
  if (can(user, "view_team"))
    parts.push(
      `${alias}.manager_id IN (SELECT id FROM hrm_employees WHERE user_id=${u})`,
    );
  if (can(user, "view_projects"))
    parts.push(
      `EXISTS(SELECT 1 FROM hrm_allocations sa JOIN projects sp ON sp.id=sa.project_id WHERE sa.employee_id=${alias}.id AND sa.archived_at IS NULL AND sa.start_date<=CURRENT_DATE AND sa.end_date>=CURRENT_DATE AND sp.payload->>'assignedTo'=${u})`,
    );
  return parts.length ? `(${parts.join(" OR ")})` : "FALSE";
}
async function employee(db, user, id, { lock = false, own = false } = {}) {
  const vals = [id];
  const s = scope(user, vals);
  const r = await db.query(
    `SELECT e.* FROM hrm_employees e WHERE e.id=$1 AND e.archived_at IS NULL AND ${s}${lock ? " FOR UPDATE OF e" : ""}`,
    vals,
  );
  if (!r.rows[0]) fail("Employee not found or outside your HR scope", 404);
  const e = camel(r.rows[0]);
  if (own && e.userId !== user.id)
    fail("This action is available only for your own employee profile", 403);
  return e;
}
async function master(db, id, type, required = false) {
  if (!id) {
    if (required) fail(`${type} is required`);
    return null;
  }
  const r = await db.query(
    "SELECT * FROM master_items WHERE id=$1 AND type=$2 AND is_active=true",
    [id, `hrm_${type}`],
  );
  if (!r.rows[0]) fail(`Invalid or inactive ${type}`);
  return camel(r.rows[0]);
}
async function audit(
  db,
  user,
  entity,
  id,
  action,
  oldValue,
  newValue,
  employeeId = null,
  sensitive = false,
  ip = null,
) {
  await insert(db, "hrm_audit", {
    actorId: user.id,
    entity,
    entityId: id,
    action,
    oldValue: oldValue ? JSON.stringify(oldValue) : null,
    newValue: newValue ? JSON.stringify(newValue) : null,
    employeeId,
    sensitive,
    ip: ip || user.hrmRequestIp || null,
  });
}
async function notify(db, userId, title, entityId, actorId) {
  if (!userId) return;
  await insert(db, "notifications", {
    recipientType: "user",
    userId,
    moduleName: "hrm",
    eventKey: "hr_update",
    entityType: "hrm",
    entityId,
    title,
    message: "Open HRM to view this update.",
    actorUserId: actorId,
    routePath: "/app/hrm",
    channels: JSON.stringify(["inApp"]),
  });
}
async function transaction(work, db) {
  return db ? work(db) : withTransaction(work);
}
function page(q) {
  return {
    page: Math.floor(number(q.page || 1, "Page", 1, 100000)),
    limit: Math.floor(number(q.limit || 25, "Page size", 1, 100)),
  };
}
function optimistic(current, body) {
  if (Number(body.version) !== current.version)
    fail("This record has changed. Refresh and try again.", 409);
}
module.exports = {
  dbDefault,
  fail,
  permit,
  can,
  text,
  number,
  date,
  instant,
  choice,
  boolean,
  allow,
  camel,
  snake,
  insert,
  update,
  policy,
  today,
  range,
  days,
  scope,
  employee,
  master,
  audit,
  notify,
  transaction,
  page,
  optimistic,
};
