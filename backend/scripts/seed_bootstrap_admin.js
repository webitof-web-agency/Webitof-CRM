const bcrypt = require('bcryptjs');

const { ensureDatabase } = require('../config/initDb');
const { closePool, query } = require('../config/db');
const { createId } = require('../utils/format');

function readBootstrapAdmin() {
  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const username = String(process.env.BOOTSTRAP_ADMIN_USERNAME || email).trim().toLowerCase();
  const name = String(process.env.BOOTSTRAP_ADMIN_NAME || 'System Admin').trim() || 'System Admin';
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '').trim();

  if (!email || !password) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required.');
  }

  return { email, username, name, password };
}

async function seedBootstrapAdmin() {
  await ensureDatabase();

  const admin = readBootstrapAdmin();
  const passwordHash = await bcrypt.hash(admin.password, 10);

  const userResult = await query(
    `select id
     from users
     where lower(email) = $1 or lower(username) = $2
     limit 1`,
    [admin.email, admin.username]
  );

  let userId = userResult.rows[0]?.id || null;
  if (userId) {
    await query(
      `update users
       set full_name = $2,
           username = $3,
           email = $4,
           password_hash = $5,
           is_active = true,
           updated_at = now()
       where id = $1`,
      [userId, admin.name, admin.username, admin.email, passwordHash]
    );
  } else {
    userId = createId('user');
    await query(
      `insert into users (id, full_name, username, email, password_hash, is_active, payload)
       values ($1, $2, $3, $4, $5, true, '{}'::jsonb)`,
      [userId, admin.name, admin.username, admin.email, passwordHash]
    );
  }

  const roleResult = await query(`select id from roles where code = 'admin' limit 1`);
  const adminRoleId = roleResult.rows[0]?.id || null;
  if (!adminRoleId) {
    throw new Error('Admin role was not found after database initialization.');
  }

  await query(
    `insert into user_roles (user_id, role_id, assigned_by)
     values ($1, $2, null)
     on conflict (user_id, role_id) do nothing`,
    [userId, adminRoleId]
  );

  const verifyResult = await query(
    `select u.email, u.username, u.full_name, u.is_active, array_agg(r.code order by r.code) as roles
     from users u
     left join user_roles ur on ur.user_id = u.id
     left join roles r on r.id = ur.role_id
     where u.id = $1
     group by u.id`,
    [userId]
  );

  console.log(JSON.stringify(verifyResult.rows[0], null, 2));
}

seedBootstrapAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
