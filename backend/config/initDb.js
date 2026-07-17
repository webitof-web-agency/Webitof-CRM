const bcrypt = require('bcryptjs');
const path = require('path');
const { query, runSqlFile, withTransaction } = require('./db');
const { DEFAULT_ROLE_DEFINITIONS, PERMISSIONS } = require('../config/rbac');
const {
  DEFAULT_SETTINGS,
  DEFAULT_SERVICE_CATEGORIES,
  DEFAULT_SERVICES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_TAX_RATES,
  DEFAULT_VENDORS,
  DEFAULT_RENEWAL_PROVIDERS,
  DEFAULT_AMC_TYPES,
  DEFAULT_BILLING_CYCLES,
  DEFAULT_INVOICE_TERMS
} = require('../database/defaultData');
const { createId } = require('../utils/format');

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

async function ensureDatabase() {
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  if (String(process.env.AUTO_INIT_DB || 'true').toLowerCase() === 'true') {
    await runSqlFile(schemaPath);
    await runSqlFile(path.join(__dirname, '..', 'database', 'storage.sql'));
  }
  await ensureLeadEventsSchema();
  if (String(process.env.SEED_DEFAULT_DATA || 'true').toLowerCase() === 'true') {
    await seedDefaultData();
  }
  await seedRbac();
}

async function ensureLeadEventsSchema() {
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS lead_id text REFERENCES leads(id) ON DELETE CASCADE;`);
  await query(`ALTER TABLE lead_events ALTER COLUMN lead_id DROP NOT NULL;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS client_id text REFERENCES clients(id) ON DELETE CASCADE;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE CASCADE;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'global';`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS scope_id text;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS owner_user_id text REFERENCES users(id) ON DELETE SET NULL;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'all_team';`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS allowed_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS allowed_team_ids jsonb NOT NULL DEFAULT '[]'::jsonb;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'event';`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS title text;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS description text;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS start_date date;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS start_time text;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS end_date date;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS end_time text;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS location text;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS labels jsonb NOT NULL DEFAULT '[]'::jsonb;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS color text;`);
  await query(`
    UPDATE lead_events
    SET
      scope_type = COALESCE(scope_type, CASE
        WHEN client_id IS NOT NULL THEN 'client'
        WHEN project_id IS NOT NULL THEN 'project'
        WHEN lead_id IS NOT NULL THEN 'lead'
        ELSE 'global'
      END),
      scope_id = COALESCE(scope_id, lead_id, client_id, project_id),
      visibility = COALESCE(visibility, 'all_team'),
      event_type = COALESCE(event_type, 'event')
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_lead_events_scope ON lead_events(scope_type, scope_id);`);
}

async function seedDefaultData() {
  const settingsCount = await query('select count(*)::int as count from app_settings');
  if ((settingsCount.rows[0]?.count || 0) === 0) {
    await query(
      `insert into app_settings (id, company, gst, tds, invoice, bank, branding, smtp, email_templates, compliance_note, roles, payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        'default',
        DEFAULT_SETTINGS.company,
        DEFAULT_SETTINGS.gst,
        DEFAULT_SETTINGS.tds,
        DEFAULT_SETTINGS.invoice,
        DEFAULT_SETTINGS.bank,
        DEFAULT_SETTINGS.branding,
        DEFAULT_SETTINGS.smtp,
        DEFAULT_SETTINGS.emailTemplates,
        DEFAULT_SETTINGS.complianceNote,
        DEFAULT_SETTINGS.roles,
        {}
      ]
    );
  }

  const masters = [
    ...DEFAULT_SERVICE_CATEGORIES,
    ...DEFAULT_SERVICES,
    ...DEFAULT_EXPENSE_CATEGORIES,
    ...DEFAULT_TAX_RATES,
    ...DEFAULT_VENDORS,
    ...DEFAULT_RENEWAL_PROVIDERS,
    ...DEFAULT_AMC_TYPES,
    ...DEFAULT_BILLING_CYCLES,
    ...DEFAULT_INVOICE_TERMS
  ];

  for (const item of masters) {
    await query(
      `insert into master_items (id, type, name, is_active, sort_order, payload)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (type, name)
       do update set is_active = excluded.is_active, sort_order = excluded.sort_order, payload = excluded.payload, updated_at = now()`,
      [
        item.id || createId(item.type || 'master'),
        item.type,
        item.name,
        item.is_active !== false,
        item.sort_order || 0,
        item.payload || {}
      ]
    );
  }
}

async function seedRbac() {
  await withTransaction(async (client) => {
    await client.query(`SET LOCAL statement_timeout = '0'`);
    await client.query(`SET LOCAL lock_timeout = '0'`);

    for (const permission of PERMISSIONS) {
      await client.query(
        `insert into permissions (id, code, name, module, action, description, is_active, payload)
         values ($1, $2, $3, $4, $5, $6, true, '{}'::jsonb)
         on conflict (code)
         do update set
           name = excluded.name,
           module = excluded.module,
           action = excluded.action,
           description = excluded.description,
           is_active = excluded.is_active,
           updated_at = now()`,
        [
          createId('perm'),
          permission.code,
          permission.name,
          permission.module,
          permission.action,
          permission.description || ''
        ]
      );
    }

    for (const role of DEFAULT_ROLE_DEFINITIONS) {
      await client.query(
        `insert into roles (id, code, name, description, is_system, is_active, payload)
         values ($1, $2, $3, $4, $5, $6, '{}'::jsonb)
         on conflict (code)
         do update set
           name = excluded.name,
           description = excluded.description,
           is_system = excluded.is_system,
           is_active = excluded.is_active,
           updated_at = now()`,
        [
          createId('role'),
          role.code,
          role.name,
          role.description || '',
          Boolean(role.isSystem),
          true
        ]
      );
    }

    const roleResult = await client.query(
      `select id, code
       from roles
       where code = any($1::text[])`,
      [DEFAULT_ROLE_DEFINITIONS.map((role) => role.code)]
    );
    const permissionResult = await client.query(
      `select id, code
       from permissions
       where code = any($1::text[])`,
      [PERMISSIONS.map((permission) => permission.code)]
    );

    const roleIdByCode = new Map(roleResult.rows.map((row) => [row.code, row.id]));
    const permissionIdByCode = new Map(permissionResult.rows.map((row) => [row.code, row.id]));

    for (const role of DEFAULT_ROLE_DEFINITIONS) {
      const roleId = roleIdByCode.get(role.code);
      if (!roleId) continue;

      await client.query('delete from role_permissions where role_id = $1', [roleId]);
      const permissionIds = [...new Set((role.permissions || []).map((code) => permissionIdByCode.get(code)).filter(Boolean))];

      for (const permissionId of permissionIds) {
        await client.query(
          `insert into role_permissions (role_id, permission_id, granted_by)
           values ($1, $2, null)
           on conflict (role_id, permission_id) do nothing`,
          [roleId, permissionId]
        );
      }
    }

    const bootstrapEmail = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@webitof.com');
    const bootstrapPassword = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Admin@12345').trim();
    const bootstrapName = String(process.env.BOOTSTRAP_ADMIN_NAME || 'System Admin').trim() || 'System Admin';
    const bootstrapUsername = normalizeUsername(process.env.BOOTSTRAP_ADMIN_USERNAME || bootstrapEmail);

    if (bootstrapEmail && bootstrapPassword) {
      const userResult = await client.query(
        `select id, email, username
         from users
         where lower(email) = $1 or lower(username) = $2
         limit 1`,
        [bootstrapEmail, bootstrapUsername]
      );

      let adminUserId = userResult.rows[0]?.id || null;
      const passwordHash = await bcrypt.hash(bootstrapPassword, 10);

      if (adminUserId) {
        await client.query(
          `update users
           set full_name = $2,
               username = $3,
               email = $4,
               is_active = true,
               updated_at = now()
           where id = $1`,
          [adminUserId, bootstrapName, bootstrapUsername, bootstrapEmail]
        );
      } else {
        adminUserId = createId('user');
        await client.query(
          `insert into users (id, full_name, username, email, password_hash, is_active, payload)
           values ($1, $2, $3, $4, $5, true, '{}'::jsonb)`,
          [adminUserId, bootstrapName, bootstrapUsername, bootstrapEmail, passwordHash]
        );
      }

      const adminRoleId = roleIdByCode.get('admin');
      if (adminRoleId) {
        await client.query(
          `insert into user_roles (user_id, role_id, assigned_by)
           values ($1, $2, null)
           on conflict (user_id, role_id) do nothing`,
          [adminUserId, adminRoleId]
        );
      }
    }
  });
}

module.exports = {
  ensureDatabase
};
