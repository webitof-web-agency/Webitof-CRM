const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { query, closePool } = require('../config/db');
const { createId } = require('../utils/format');

const SALES_PERMISSION_CODES = [
  'dashboard.view',
  'clients.read',
  'clients.write',
  'projects.read',
  'projects.write',
  'invoices.read',
  'invoices.write',
  'files.read'
];

const MANAGER_PERMISSION_CODES = [
  'dashboard.view',
  'clients.read',
  'clients.write',
  'clients.delete',
  'projects.read',
  'projects.write',
  'projects.delete',
  'invoices.read',
  'invoices.write',
  'invoices.delete',
  'payments.read',
  'payments.write',
  'expenses.read',
  'expenses.write',
  'lead-commissions.read',
  'banking.read',
  'amc.read',
  'renewals.read',
  'masters.read',
  'reports.view',
  'files.read'
];

const SUPPORT_PERMISSION_CODES = [
  'dashboard.view',
  'clients.read',
  'projects.read',
  'invoices.read',
  'reports.view',
  'files.read'
];

const DEMO_LEADS = [
  {
    companyName: 'TechVision India Pvt Ltd',
    ownerName: 'Rajeev Sharma',
    createdBy: { fullName: 'Super Admin', username: 'admin', email: 'admin@webitof.com', password: 'Admin@123', roleCode: 'admin' },
    assignedTo: { fullName: 'Sales Executive', username: 'sales', email: 'sales@webitof.com', password: 'Sales@123', roleCode: 'sales' },
    source: 'Website',
    status: 'New',
    labels: ['Enterprise', 'Hot'],
    followUpDate: '2026-07-15',
    contacts: [
      { firstName: 'Sanjay', lastName: 'Mehta', email: 'sanjay.mehta@techvision.in', phone: '+91 9810011001', jobTitle: 'CTO', notes: 'Primary decision maker' },
      { firstName: 'Pooja', lastName: 'Nair', email: 'pooja.nair@techvision.in', phone: '+91 9810011002', jobTitle: 'Operations Head', notes: 'Secondary contact' }
    ]
  },
  {
    companyName: 'Sharma Retailers',
    ownerName: 'Anjali Verma',
    createdBy: { fullName: 'Sales Executive', username: 'sales', email: 'sales@webitof.com', password: 'Sales@123', roleCode: 'sales' },
    assignedTo: { fullName: 'Sales Manager', username: 'manager', email: 'manager@webitof.com', password: 'Manager@123', roleCode: 'manager' },
    source: 'Referral',
    status: 'Qualified',
    labels: ['Retail', 'Warm'],
    followUpDate: '2026-07-05',
    contacts: [
      { firstName: 'Neel', lastName: 'Gupta', email: 'neel@sharmaretail.com', phone: '+91 9810022001', jobTitle: 'Owner', notes: 'Primary contact for pricing' }
    ]
  },
  {
    companyName: 'Patel Logistics',
    ownerName: 'Manoj Patel',
    createdBy: { fullName: 'Sales Manager', username: 'manager', email: 'manager@webitof.com', password: 'Manager@123', roleCode: 'manager' },
    assignedTo: { fullName: 'Support Executive', username: 'support', email: 'support@webitof.com', password: 'Support@123', roleCode: 'support' },
    source: 'Trade Show',
    status: 'Qualified',
    labels: ['Logistics', 'Hot'],
    followUpDate: '2026-06-30',
    contacts: [
      { firstName: 'Harshil', lastName: 'Mehta', email: 'harshil@patellogistics.com', phone: '+91 9810033001', jobTitle: 'Logistics Head', notes: 'Handles purchase and operations' },
      { firstName: 'Ritika', lastName: 'Joshi', email: 'ritika@patellogistics.com', phone: '+91 9810033002', jobTitle: 'Accounts', notes: 'Billing and invoicing' }
    ]
  },
  {
    companyName: 'Reddy Healthcare',
    ownerName: 'Sunil Reddy',
    createdBy: { fullName: 'Support Executive', username: 'support', email: 'support@webitof.com', password: 'Support@123', roleCode: 'support' },
    assignedTo: { fullName: 'Sales Executive', username: 'sales', email: 'sales@webitof.com', password: 'Sales@123', roleCode: 'sales' },
    source: 'Cold Call',
    status: 'Lost',
    labels: ['Healthcare'],
    followUpDate: '2026-08-10',
    contacts: [
      { firstName: 'Dr. Kavya', lastName: 'Reddy', email: 'kavya@reddyhealth.in', phone: '+91 9810044001', jobTitle: 'Founder', notes: 'Primary decision maker' }
    ]
  },
  {
    companyName: 'Singh Enterprises',
    ownerName: 'Vikas Singh',
    createdBy: { fullName: 'Super Admin', username: 'admin', email: 'admin@webitof.com', password: 'Admin@123', roleCode: 'admin' },
    assignedTo: { fullName: 'Sales Manager', username: 'manager', email: 'manager@webitof.com', password: 'Manager@123', roleCode: 'manager' },
    source: 'Cold Call',
    status: 'New',
    labels: ['SMB', 'Follow-up'],
    followUpDate: '2026-07-20',
    contacts: [
      { firstName: 'Aman', lastName: 'Singh', email: 'aman@singhent.com', phone: '+91 9810055001', jobTitle: 'Operations Manager', notes: 'Handles technology evaluation' }
    ]
  },
  {
    companyName: 'Gupta Traders',
    ownerName: 'Neha Agarwal',
    createdBy: { fullName: 'Sales Manager', username: 'manager', email: 'manager@webitof.com', password: 'Manager@123', roleCode: 'manager' },
    assignedTo: { fullName: 'Sales Executive', username: 'sales', email: 'sales@webitof.com', password: 'Sales@123', roleCode: 'sales' },
    source: 'Website',
    status: 'Qualified',
    labels: ['E-commerce', 'Hot'],
    followUpDate: '2026-07-25',
    contacts: [
      { firstName: 'Deepak', lastName: 'Jain', email: 'deepak@guptatraders.in', phone: '+91 9810066001', jobTitle: 'Procurement Head', notes: 'Interested in CRM integrations' },
      { firstName: 'Sonal', lastName: 'Verma', email: 'sonal@guptatraders.in', phone: '+91 9810066002', jobTitle: 'Purchase Manager', notes: 'Secondary contact' }
    ]
  },
  {
    companyName: 'Das Consultancy',
    ownerName: 'Arjun Das',
    createdBy: { fullName: 'Super Admin', username: 'admin', email: 'admin@webitof.com', password: 'Admin@123', roleCode: 'admin' },
    assignedTo: { fullName: 'Support Executive', username: 'support', email: 'support@webitof.com', password: 'Support@123', roleCode: 'support' },
    source: 'Referral',
    status: 'New',
    labels: ['Consulting'],
    followUpDate: '2026-08-15',
    contacts: [
      { firstName: 'Sneha', lastName: 'Das', email: 'sneha@dasconsult.com', phone: '+91 9810077001', jobTitle: 'Partner', notes: 'Primary business contact' },
      { firstName: 'Kabir', lastName: 'Sen', email: 'kabir@dasconsult.com', phone: '+91 9810077002', jobTitle: 'Consultant', notes: 'Supports decision making' }
    ]
  }
];

async function getPermissionIdsByCode(codes) {
  const result = await query(
    `select id, code
     from permissions
     where code = any($1::text[])`,
    [codes]
  );
  return new Map(result.rows.map((row) => [row.code, row.id]));
}

async function upsertRole({ code, name, description, permissionIds }) {
  const existing = await query('select id from roles where code = $1 limit 1', [code]);
  const roleId = existing.rows[0]?.id || createId('role');

  if (existing.rows.length) {
    await query(
      `update roles
       set name = $2,
           description = $3,
           is_system = true,
           is_active = true,
           updated_at = now()
       where id = $1`,
      [roleId, name, description]
    );
  } else {
    await query(
      `insert into roles (id, code, name, description, is_system, is_active, payload)
       values ($1, $2, $3, $4, true, true, '{}'::jsonb)`,
      [roleId, code, name, description]
    );
  }

  await query('delete from role_permissions where role_id = $1', [roleId]);
  for (const permissionId of permissionIds) {
    await query(
      `insert into role_permissions (role_id, permission_id, granted_by)
       values ($1, $2, null)
       on conflict (role_id, permission_id) do nothing`,
      [roleId, permissionId]
    );
  }

  return roleId;
}

async function upsertUser({ fullName, username, email, password, roleId }) {
  const existing = await query(
    `select id
     from users
     where lower(username) = lower($1) or lower(email) = lower($2)
     limit 1`,
    [username, email]
  );

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = existing.rows[0]?.id || createId('user');

  if (existing.rows.length) {
    await query(
      `update users
       set full_name = $2,
           username = $3,
           email = $4,
           password_hash = $5,
           is_active = true,
           updated_at = now()
       where id = $1`,
      [userId, fullName, username, email, passwordHash]
    );
  } else {
    await query(
      `insert into users (id, full_name, username, email, password_hash, is_active, payload)
       values ($1, $2, $3, $4, $5, true, '{}'::jsonb)`,
      [userId, fullName, username, email, passwordHash]
    );
  }

  await query('delete from user_roles where user_id = $1 and role_id <> $2', [userId, roleId]);
  await query(
    `insert into user_roles (user_id, role_id, assigned_by)
     values ($1, $2, null)
     on conflict (user_id, role_id) do nothing`,
    [userId, roleId]
  );

  return userId;
}

async function main() {
  const permissionIdMap = await getPermissionIdsByCode([
    ...SALES_PERMISSION_CODES,
    ...MANAGER_PERMISSION_CODES,
    ...SUPPORT_PERMISSION_CODES
  ]);
  const allPermissionIds = await query('select id, code from permissions');
  const allIds = allPermissionIds.rows.map((row) => row.id);

  const roleIdByCode = new Map();
  roleIdByCode.set('admin', await upsertRole({
    code: 'admin',
    name: 'System Admin',
    description: 'Super Administrator with all permissions',
    permissionIds: allIds
  }));
  roleIdByCode.set('sales', await upsertRole({
    code: 'sales',
    name: 'Sales',
    description: 'CRM & Client management',
    permissionIds: SALES_PERMISSION_CODES.map((code) => permissionIdMap.get(code)).filter(Boolean)
  }));
  roleIdByCode.set('manager', await upsertRole({
    code: 'manager',
    name: 'Manager',
    description: 'Sales and client oversight',
    permissionIds: MANAGER_PERMISSION_CODES.map((code) => permissionIdMap.get(code)).filter(Boolean)
  }));
  roleIdByCode.set('support', await upsertRole({
    code: 'support',
    name: 'Support',
    description: 'Support and follow-up team',
    permissionIds: SUPPORT_PERMISSION_CODES.map((code) => permissionIdMap.get(code)).filter(Boolean)
  }));

  const userIdByCode = new Map();
  for (const roleCode of ['admin', 'sales', 'manager', 'support']) {
    const roleId = roleIdByCode.get(roleCode);
    const sourceLead = DEMO_LEADS.find((item) => item.createdBy.roleCode === roleCode) || DEMO_LEADS.find((item) => item.assignedTo.roleCode === roleCode);
    if (!sourceLead) continue;

    const demoUser = sourceLead.createdBy.roleCode === roleCode ? sourceLead.createdBy : sourceLead.assignedTo;
    userIdByCode.set(roleCode, await upsertUser({
      fullName: demoUser.fullName,
      username: demoUser.username,
      email: demoUser.email,
      password: demoUser.password,
      roleId
    }));
  }

  for (const demoLead of DEMO_LEADS) {
    const userCreatedById = userIdByCode.get(demoLead.createdBy.roleCode);
    const userAssignedToId = userIdByCode.get(demoLead.assignedTo.roleCode);

    const leadResult = await query(
      `select id, created_at, updated_at, created_by, assigned_to, status
       from leads
       where company_name = $1 or name = $1
       limit 1`,
      [demoLead.companyName]
    );

    if (!leadResult.rows.length) continue;

    const leadId = leadResult.rows[0].id;
    await query(
      `update leads
       set name = $2,
           company_name = $3,
           owner_name = $4,
           assigned_to = $5,
           created_by = $6,
           labels = $7::jsonb,
           source = $8,
           status = $9,
           follow_up_date = $10,
           updated_at = now()
       where id = $1`,
      [
        leadId,
        demoLead.companyName,
        demoLead.companyName,
        demoLead.assignedTo.fullName,
        userAssignedToId,
        userCreatedById,
        JSON.stringify(demoLead.labels),
        demoLead.source,
        demoLead.status,
        demoLead.followUpDate
      ]
    );

    await query('delete from lead_events where lead_id = $1 and event_type = $2', [leadId, 'system']);

    const createdByName = demoLead.createdBy.fullName;
    const rawCreatedAt = leadResult.rows[0].created_at || new Date();
    const followUpDate = (rawCreatedAt instanceof Date ? rawCreatedAt : new Date(rawCreatedAt)).toISOString();
    await query(
      `insert into lead_events
        (id, lead_id, event_type, title, description, start_date, end_date, payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        createId('lead-event'),
        leadId,
        'system',
        'Lead created',
        `Created by ${createdByName}`,
        String(followUpDate).slice(0, 10),
        String(followUpDate).slice(0, 10),
        JSON.stringify({
          kind: 'created',
          actorUserId: userIdByCode.get(demoLead.createdBy.roleCode) || null,
          actorName: createdByName,
          meta: {
            ownerName: demoLead.ownerName
          }
        })
      ]
    );

    if (leadResult.rows[0].updated_at && String(leadResult.rows[0].updated_at) !== String(leadResult.rows[0].created_at || '')) {
      const updatedByName = demoLead.assignedTo.fullName;
      await query(
        `insert into lead_events
          (id, lead_id, event_type, title, description, start_date, end_date, payload)
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          createId('lead-event'),
          leadId,
          'system',
          'Lead updated',
          `Updated by ${updatedByName}`,
          (new Date(leadResult.rows[0].updated_at)).toISOString().slice(0, 10),
          (new Date(leadResult.rows[0].updated_at)).toISOString().slice(0, 10),
          JSON.stringify({
            kind: 'updated',
            actorUserId: userIdByCode.get(demoLead.assignedTo.roleCode) || null,
            actorName: updatedByName,
            meta: {
              fields: ['ownerName', 'status', 'labels', 'followUpDate']
            }
          })
        ]
      );
    }

    await query(
      `insert into lead_events
        (id, lead_id, event_type, title, description, start_date, end_date, payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        createId('lead-event'),
        leadId,
        'system',
        `Status set to ${demoLead.status}`,
        `Current status is ${demoLead.status}`,
        (new Date(leadResult.rows[0].created_at || new Date())).toISOString().slice(0, 10),
        (new Date(leadResult.rows[0].created_at || new Date())).toISOString().slice(0, 10),
        JSON.stringify({
          kind: 'status_changed',
          actorUserId: userIdByCode.get(demoLead.assignedTo.roleCode) || null,
          actorName: demoLead.assignedTo.fullName,
          meta: {
            previousStatus: '',
            nextStatus: demoLead.status
          }
        })
      ]
    );

    await query('delete from lead_contacts where lead_id = $1', [leadId]);
    for (const contact of demoLead.contacts) {
      await query(
        `insert into lead_contacts
          (id, lead_id, first_name, last_name, email, phone, job_title, gender, notes, payload)
         values ($1, $2, $3, $4, $5, $6, $7, 'Other', $8, '{}'::jsonb)`,
        [
          createId('lead-contact'),
          leadId,
          contact.firstName,
          contact.lastName,
          contact.email,
          contact.phone,
          contact.jobTitle,
          contact.notes
        ]
      );
    }
  }

  console.log('Lead demo data patched successfully.');
}

main()
  .then(() => closePool())
  .catch(async (error) => {
    console.error(error);
    await closePool();
    process.exitCode = 1;
  });
