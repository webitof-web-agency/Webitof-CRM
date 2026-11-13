// Every API route x every role, over real HTTP:
//   - no token            -> 401 on every non-public route
//   - guard denies a role -> 403 "Missing permission"
//   - guard allows a role -> never that 403, and never a 500 (a crash on a bad id/empty body)
// Ids in paths are random, so no real record is touched; write routes get an empty body.
// Run: QA_API_URL=... QA_DATABASE_URL=... node --test tests/e2e/rbacMatrix.e2e.js
const { api, fixtures, closeDb } = require('./lib');
const { listRoutes, guardAllows } = require('./routes');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// Reached by a role the guard allows, these change shared config or start long jobs even with an
// empty body. Their denial is still checked; the allowed call is covered by targeted suites.
const SKIP_WHEN_ALLOWED = new Set([
  'POST /google-drive/backups/:fileId/restore',
  'POST /google-drive/backups/run',
  'PUT /settings/',
  'PUT /settings/storage',
  'PUT /google-drive/config',
  'POST /google-drive/disconnect',
  'PUT /follow-ups/settings',
  'POST /maintenance/clear',
  'POST /auth/change-password',
  'PATCH /auth/profile',
  'DELETE /auth/avatar'
]);

const ROLES = ['zero', 'readonly', 'employee', 'hrm_manager', 'hr', 'sales', 'accountant', 'usermgr', 'admin'];

function fill(path) {
  return path
    .replace(/:type\b/g, 'qa_type')
    .replace(/:kind\b/g, 'qa_kind')
    .replace(/:[A-Za-z]+/g, () => `qa_missing_${Math.random().toString(36).slice(2, 8)}`)
    .replace(/\/$/, '') || '/';
}

const results = [];

test('route x role matrix', async (t) => {
  const f = await fixtures();
  const profiles = {};
  for (const role of ROLES) {
    profiles[role] = (await api('/auth/me', { token: f.tokens[role] })).body.data;
  }
  const all = listRoutes();
  // A path mounted publicly earlier (e.g. GET /invoices/public/:id) is answered by that public route.
  const publicKeys = new Set(all.filter((r) => r.public).map((r) => `${r.method} ${r.path}`));
  const routes = all.filter((r) => !r.public && !publicKeys.has(`${r.method} ${r.path}`) && !r.path.startsWith('/auth/'));

  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    await t.test(key, async () => {
      const url = fill(route.path);
      const body = ['GET', 'DELETE'].includes(route.method) ? undefined : {};
      const anon = await api(url, { method: route.method, body });
      assert.equal(anon.status, 401, `${key} without a token gave ${anon.status}`);

      const problems = [];
      await Promise.all(ROLES.map(async (role) => {
        const allowed = guardAllows(route, profiles[role]);
        if (allowed && SKIP_WHEN_ALLOWED.has(key)) return;
        const res = await api(url, { method: route.method, body, token: f.tokens[role] });
        const guard403 = res.status === 403 && /Missing permission/.test(res.body?.message || '');
        results.push({ route: key, role, allowed, status: res.status, message: res.body?.message || '', count: Array.isArray(res.body?.data) ? res.body.data.length : undefined });
        if (!allowed && !guard403) problems.push(`${role}: guard should deny but got ${res.status} ${res.body?.message || ''}`);
        if (allowed && guard403) problems.push(`${role}: guard allows but got "Missing permission"`);
        if (res.status >= 500) problems.push(`${role}: ${res.status} ${res.body?.message || res.text.slice(0, 120)}`);
      }));
      assert.deepEqual(problems, [], problems.join('\n'));
    });
  }
});

test.after(async () => {
  if (process.env.QA_REPORT_DIR) {
    fs.mkdirSync(process.env.QA_REPORT_DIR, { recursive: true });
    fs.writeFileSync(`${process.env.QA_REPORT_DIR}/rbac-matrix.json`, JSON.stringify(results, null, 1));
  }
  await closeDb();
});
