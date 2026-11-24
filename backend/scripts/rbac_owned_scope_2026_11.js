// One-time role update (2026-11): adds the CTO and Sales Manager roles and limits Sales and
// Accountant to their own leads, calls and clients. Live installs run with SEED_DEFAULT_DATA=false,
// so config/rbac.js changes never reach existing grants on their own.
//
//   node scripts/rbac_owned_scope_2026_11.js           dry run: prints what would change
//   node scripts/rbac_owned_scope_2026_11.js --apply   writes it (take a pg_dump first)
//
// Safe to run again: every step is an upsert or a delete of a named grant.
require('dotenv').config();
const { query, withTransaction } = require('../config/db');
const { seedRbac } = require('../config/initDb');
const { PERMISSIONS } = require('../config/rbac');

const APPLY = process.argv.includes('--apply');

// Grants taken away from roles that already exist on the install.
const REVOKE = {
  sales: ['leads.view_all', 'leads.assign', 'followups.view_team', 'followups.reassign'],
  accountant: ['leads.view_all']
};
// Grants added to roles that already exist (new permission codes the role should have).
const GRANT = {
  accountant: ['clients.view_all'],
  admin: ['clients.view_all', 'calls.view_all']
};

async function roleSnapshot() {
  const result = await query(
    `select r.code, count(p.id) filter (where p.module <> 'hrm')::int as crm, count(p.id) filter (where p.module = 'hrm')::int as hrm,
            (select count(*)::int from user_roles ur where ur.role_id = r.id) as users
     from roles r left join role_permissions rp on rp.role_id = r.id left join permissions p on p.id = rp.permission_id
     group by r.id order by r.code`
  );
  return result.rows;
}

async function main() {
  console.log(APPLY ? 'APPLY mode' : 'DRY RUN (pass --apply to write)');
  console.table(await roleSnapshot());

  const existing = new Set((await query('select code from roles')).rows.map((row) => row.code));
  ['cto', 'sales_manager'].forEach((code) => {
    console.log(existing.has(code) ? `role ${code}: exists, grants left as they are` : `role ${code}: will be created with its default grants`);
  });
  const knownPermissions = new Set((await query('select code from permissions')).rows.map((row) => row.code));
  PERMISSIONS.filter((permission) => !knownPermissions.has(permission.code))
    .forEach((permission) => console.log(`permission ${permission.code}: will be created`));
  Object.entries(REVOKE).forEach(([role, codes]) => console.log(`role ${role}: revoke ${codes.join(', ')}`));
  Object.entries(GRANT).forEach(([role, codes]) => console.log(`role ${role}: grant ${codes.join(', ')}`));

  if (!APPLY) return;

  // Upserts the permission catalog and default roles; brand-new roles get their default grants.
  await seedRbac({ resetDefaultGrants: false });

  await withTransaction(async (client) => {
    for (const [role, codes] of Object.entries(REVOKE)) {
      const result = await client.query(
        `delete from role_permissions
         where role_id = (select id from roles where code = $1)
           and permission_id in (select id from permissions where code = any($2::text[]))`,
        [role, codes]
      );
      console.log(`role ${role}: ${result.rowCount} grant(s) revoked`);
    }
    for (const [role, codes] of Object.entries(GRANT)) {
      const result = await client.query(
        `insert into role_permissions (role_id, permission_id, granted_by)
         select r.id, p.id, null from roles r cross join permissions p
         where r.code = $1 and p.code = any($2::text[])
         on conflict (role_id, permission_id) do nothing`,
        [role, codes]
      );
      console.log(`role ${role}: ${result.rowCount} grant(s) added`);
    }
  });

  console.log('After:');
  console.table(await roleSnapshot());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
