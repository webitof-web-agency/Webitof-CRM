// Shared helpers for the end-to-end QA suites (tests/e2e/*.e2e.js).
//
// These suites drive a REAL running API over HTTP and create users, roles, leads, invoices and
// HRM records through it. They must never reach the live database, so they refuse to start
// unless both of these point at a disposable local stack:
//   QA_API_URL       e.g. http://127.0.0.1:5055/api  (a backend started on its own port)
//   QA_DATABASE_URL  the local database that backend uses, e.g. .../webitofcrm_qa
// Port 5000 is refused: on a developer machine that backend is usually on the live DB.
// Start the QA backend with every integration blanked (SMTP, Drive, Firebase), see README.md.
const crypto = require('node:crypto');

const API = process.env.QA_API_URL || '';
const DB_URL = process.env.QA_DATABASE_URL || '';

function refuse(message) {
  console.log(`# skipped ${require('node:path').basename(require.main?.filename || 'e2e')}: ${message}`);
  process.exit(0);
}

if (!API || !DB_URL) refuse('set QA_API_URL and QA_DATABASE_URL to a disposable local stack');
{
  const api = new URL(API);
  const db = new URL(DB_URL);
  const local = (host) => ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host);
  if (!local(api.hostname) || !local(db.hostname)) refuse('QA_API_URL and QA_DATABASE_URL must be local');
  if (api.port === '5000') refuse('port 5000 is the everyday backend (live DB); start a QA backend on another port');
  if (/prod/i.test(db.pathname)) refuse('QA_DATABASE_URL looks like a production database');
}
// Anything in this process that touches Postgres directly goes to the QA database.
process.env.DATABASE_URL = DB_URL;
process.env.FIREBASE_SERVICE_ACCOUNT_PATH = '';

const ADMIN = {
  identifier: process.env.QA_ADMIN_EMAIL || 'qa.admin@webitof.test',
  password: process.env.QA_ADMIN_PASSWORD || 'QaAdmin@12345'
};

// Letters only: person names reject digits.
const tag = crypto.randomBytes(3).toString('hex').replace(/\d/g, (d) => 'ghijklmnop'[d]);

async function api(path, { method = 'GET', token, body, headers = {}, raw = false } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !isForm && typeof body !== 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    body: body === undefined ? undefined : (isForm || typeof body === 'string' ? body : JSON.stringify(body))
  });
  if (raw) return response;
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, body: json, text, headers: response.headers };
}

async function login(identifier, password) {
  const res = await api('/auth/login', { method: 'POST', body: { identifier, password } });
  if (res.status !== 200) throw new Error(`login ${identifier}: ${res.status} ${res.text.slice(0, 200)}`);
  return res.body.data.token || res.body.data.accessToken;
}

function ok(res, label = '') {
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`${label} expected 2xx, got ${res.status}: ${res.text.slice(0, 300)}`);
  }
  return res.body?.data;
}

let dbPool = null;
function db() {
  if (!dbPool) {
    const { Pool } = require('pg');
    dbPool = new Pool({ connectionString: DB_URL, max: 3 });
  }
  return dbPool;
}
async function sql(text, params = []) {
  return (await db().query(text, params)).rows;
}
async function closeDb() {
  if (dbPool) await dbPool.end();
  dbPool = null;
}

// ---- role fixtures ---------------------------------------------------------------------------

const PASSWORD = 'QaUser@12345';

// Person names allow letters, spaces and . ' - only.
const personName = (key) => `QA ${key.replace(/_/g, ' ').replace(/\d/g, (d) => ` n${'abcdefghij'[d]}`)} ${tag}`;

// Custom roles the suites create on top of the seeded admin/accountant/sales/employee.
const CUSTOM_ROLES = {
  qa_zero: () => [],
  qa_readonly: (all) => all.filter((code) => /\.(read|view|view_own|view_all|view_team)$/.test(code) && !code.startsWith('hrm.')),
  qa_usermgr: () => ['users.manage', 'roles.manage', 'dashboard.view'],
  qa_hrm_manager: () => ['hrm.view_own', 'hrm.self_service', 'hrm.view_team', 'hrm.approve'],
  qa_hr: (all) => all.filter((code) => code.startsWith('hrm.'))
};

let cached = null;

// Logs in as the bootstrap admin, creates one user per role (plus an inactive one) and returns
// { tokens, users, roles, permissions }. Safe to call from every suite; it runs once per process.
async function fixtures() {
  if (cached) return cached;
  const adminToken = await login(ADMIN.identifier, ADMIN.password);
  const permissions = ok(await api('/permissions', { token: adminToken }), 'permissions');
  const allCodes = permissions.map((p) => p.code);
  const idByCode = Object.fromEntries(permissions.map((p) => [p.code, p.id]));
  const roles = Object.fromEntries(ok(await api('/roles', { token: adminToken }), 'roles').map((r) => [r.code, r]));

  for (const [code, pick] of Object.entries(CUSTOM_ROLES)) {
    const roleCode = `${code}_${tag}`;
    const created = ok(await api('/roles', {
      method: 'POST',
      token: adminToken,
      body: { code: roleCode, name: `${code} ${tag}`, permissionIds: pick(allCodes).map((c) => idByCode[c]) }
    }), `create role ${code}`);
    roles[code] = created;
  }

  const userSpecs = {
    accountant: ['accountant'],
    sales: ['sales'],
    sales2: ['sales'],
    employee: ['employee'],
    employee2: ['employee'],
    hrm_manager: ['qa_hrm_manager'],
    hr: ['qa_hr', 'employee'],
    zero: ['qa_zero'],
    readonly: ['qa_readonly'],
    usermgr: ['qa_usermgr'],
    inactive: ['sales']
  };
  const users = {};
  const tokens = { admin: adminToken };
  for (const [key, roleCodes] of Object.entries(userSpecs)) {
    const email = `qa.${key}.${tag}@webitof.test`;
    const user = ok(await api('/users', {
      method: 'POST',
      token: adminToken,
      body: {
        fullName: personName(key),
        email,
        username: `qa.${key}.${tag}`,
        password: PASSWORD,
        isActive: key !== 'inactive',
        roleIds: roleCodes.map((c) => roles[c].id)
      }
    }), `create user ${key}`);
    users[key] = { ...user, email };
    if (key !== 'inactive') tokens[key] = await login(email, PASSWORD);
  }
  const me = ok(await api('/auth/me', { token: adminToken }), 'me');
  users.admin = { ...me, email: ADMIN.identifier };

  cached = { tokens, users, roles, permissions: allCodes, adminToken, tag, PASSWORD };
  return cached;
}

// HRM employees for the HRM suites: manager M with employee A reporting to M, employee B elsewhere,
// and the HR user. Each is linked to its login so /hrm/me style calls resolve.
async function hrmFixtures() {
  const f = await fixtures();
  if (f.hrm) return f.hrm;
  const today = new Date().toISOString().slice(0, 10);
  const make = async (key, extra = {}) => ok(await api('/hrm/employees', {
    method: 'POST',
    token: f.adminToken,
    body: { userId: f.users[key].id, fullName: personName(key), joiningDate: '2025-04-01', status: 'Active', ...extra }
  }), `hrm employee ${key}`);
  const manager = await make('hrm_manager');
  const a = await make('employee', { managerId: manager.id });
  const b = await make('employee2');
  const hr = await make('hr');
  f.hrm = { manager, a, b, hr, today };
  return f.hrm;
}

function forgeToken(payload, secret = 'wrong-secret', options = {}) {
  return require('jsonwebtoken').sign(payload, secret, options);
}

module.exports = { API, ADMIN, PASSWORD, tag, api, login, ok, sql, closeDb, fixtures, hrmFixtures, forgeToken };
