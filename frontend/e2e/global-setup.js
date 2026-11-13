// Creates one user per role through the QA API (backend/tests/e2e/lib.js) and saves their logins
// for the specs. Needs QA_API_URL and QA_DATABASE_URL, same as the backend e2e suites.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default async function globalSetup() {
  const lib = require('../../backend/tests/e2e/lib.js');
  const f = await lib.fixtures();
  const roles = ['admin', 'accountant', 'sales', 'employee', 'hrm_manager', 'zero', 'readonly'];
  const users = {};
  for (const role of roles) {
    const me = (await lib.api('/auth/me', { token: f.tokens[role] })).body.data;
    users[role] = {
      email: f.users[role].email,
      password: role === 'admin' ? lib.ADMIN.password : f.PASSWORD,
      permissions: me.permissions,
      isSuperAdmin: me.isSuperAdmin
    };
  }
  await lib.closeDb();
  fs.mkdirSync(path.join(import.meta.dirname, '.auth'), { recursive: true });
  fs.writeFileSync(path.join(import.meta.dirname, '.auth', 'users.json'), JSON.stringify(users, null, 2));
}
